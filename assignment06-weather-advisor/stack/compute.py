"""User-data and launch-template helpers for Assignment 6."""

from __future__ import annotations

import base64
import logging

from botocore.exceptions import ClientError

from stack.clients import AwsClients
from stack.config import Settings, Tier


log = logging.getLogger("stack")


def _b64_file(path) -> str:
    """Return a file as a base64 string."""

    return base64.b64encode(
        path.read_bytes()
    ).decode()


def build_user_data(
    settings: Settings,
    tier: Tier,
    *,
    alb_dns_name: str | None = None,
    db_host: str | None = None,
) -> str:
    """Build EC2 user-data for Weather or Advisor."""

    app_js = _b64_file(
        tier.app_dir / "app.js"
    )

    package_json = _b64_file(
        tier.app_dir / "package.json"
    )

    if tier.name == "weather":
        if not db_host:
            raise ValueError(
                "Weather user-data requires db_host."
            )

        extra_setup = """
dnf install -y postgresql15
curl -sS \
  -o /opt/app/rds-ca.pem \
  https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem
"""

        environment = f"""
Environment="NWS_USER_AGENT=(itmo-444-544 weather lab, {settings.contact_email})"
Environment=DB_HOST={db_host}
Environment=DB_NAME={settings.database.name}
Environment=DB_USER={settings.database.user}
Environment=DB_PASSWORD_PARAM={settings.database.password_param}
Environment=CACHE_SECONDS={settings.cache_seconds}
"""

    elif tier.name == "advisor":
        if not alb_dns_name:
            raise ValueError(
                "Advisor user-data requires alb_dns_name."
            )

        extra_setup = ""

        environment = f"""
Environment=WEATHER_URL=http://{alb_dns_name}:{settings.weather.listener_port}
Environment=GEMINI_KEY_PARAM={settings.gemini_param_name}
Environment=GEMINI_MODEL={settings.gemini_model}
Environment=KEY_CACHE_SECONDS={settings.key_cache_seconds}
"""

    else:
        raise ValueError(
            f"Unknown tier: {tier.name}"
        )

    return f"""#!/bin/bash
set -e

dnf update -y
dnf install -y nodejs openssh-server
systemctl enable --now sshd
systemctl status sshd --no-pager || true
ss -lntp | grep ':22' || true

mkdir -p /opt/app

{extra_setup}

echo '{app_js}' | base64 -d > /opt/app/app.js
echo '{package_json}' | base64 -d > /opt/app/package.json

cd /opt/app
npm install --omit=dev

cat > /etc/systemd/system/{tier.service_name}.service <<'SERVICE'
[Unit]
Description={tier.name.capitalize()} App
After=network.target

[Service]
Environment=PORT={settings.app_port}
Environment=AWS_REGION={settings.region}
{environment}
WorkingDirectory=/opt/app
ExecStart=/usr/bin/node /opt/app/app.js
Restart=always
User=ec2-user

[Install]
WantedBy=multi-user.target
SERVICE

chown -R ec2-user:ec2-user /opt/app

systemctl daemon-reload
systemctl enable {tier.service_name}.service
systemctl start {tier.service_name}.service
"""


def launch_template_data(
    settings: Settings,
    tier: Tier,
    *,
    alb_dns_name: str | None = None,
    db_host: str | None = None,
) -> dict:
    """Build EC2 launch-template data."""

    user_data = build_user_data(
        settings,
        tier,
        alb_dns_name=alb_dns_name,
        db_host=db_host,
    )

    return {
        "ImageId": settings.ami_id,
        "InstanceType": settings.instance_type,
        "KeyName": settings.key_name,

        "SecurityGroupIds": [
            settings.app_security_group_id
        ],

        "IamInstanceProfile": {
            "Name": tier.profile_name
        },

        "UserData": base64.b64encode(
            user_data.encode()
        ).decode(),

        "TagSpecifications": [
            {
                "ResourceType": "instance",
                "Tags": [
                    {
                        "Key": "Name",
                        "Value": f"{tier.name}-app",
                    }
                ],
            }
        ],
    }


def launch_template_exists(
    aws: AwsClients,
    tier: Tier,
) -> bool:
    """Return True if the launch template exists."""

    try:
        aws.ec2.describe_launch_templates(
            LaunchTemplateNames=[
                tier.lt_name
            ]
        )

        return True

    except ClientError as err:
        code = (
            err.response
            .get("Error", {})
            .get("Code")
        )

        if (
            code ==
            "InvalidLaunchTemplateName.NotFoundException"
        ):
            return False

        raise


def ensure_launch_template(
    aws: AwsClients,
    settings: Settings,
    tier: Tier,
    *,
    alb_dns_name: str | None = None,
    db_host: str | None = None,
) -> int:
    """Create the template or publish a new version."""

    data = launch_template_data(
        settings,
        tier,
        alb_dns_name=alb_dns_name,
        db_host=db_host,
    )

    if not launch_template_exists(
        aws,
        tier,
    ):
        aws.ec2.create_launch_template(
            LaunchTemplateName=tier.lt_name,
            LaunchTemplateData=data,
        )

        log.info(
            "Created launch template %s",
            tier.lt_name,
        )

        return 1

    response = (
        aws.ec2.create_launch_template_version(
            LaunchTemplateName=tier.lt_name,
            SourceVersion="1",
            LaunchTemplateData=data,
        )
    )

    version = response[
        "LaunchTemplateVersion"
    ]["VersionNumber"]

    log.info(
        "Launch template %s published version %s",
        tier.lt_name,
        version,
    )

    return version


def delete_launch_template(
    aws: AwsClients,
    tier: Tier,
) -> None:
    """Delete a launch template if it exists."""

    if not launch_template_exists(
        aws,
        tier,
    ):
        return

    aws.ec2.delete_launch_template(
        LaunchTemplateName=tier.lt_name
    )

    log.info(
        "Deleted launch template %s",
        tier.lt_name,
    )
