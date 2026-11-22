"""EC2 launch-template and Python bootstrap helpers."""

from __future__ import annotations

import base64
import logging

from botocore.exceptions import ClientError

from stack.clients import AwsClients
from stack.config import Settings, Tier


log = logging.getLogger("stack")


REPO_URL = (
    "https://github.com/Hasan-2077/444-cloud.git"
)

REPO_DIR = "/opt/444-cloud"


def environment_for(
    settings: Settings,
    tier: Tier,
    *,
    alb_dns_name: str | None = None,
) -> dict[str, str]:
    """Return environment variables for one application tier."""

    common = {
        "PORT":
            str(settings.app_port),

        "AWS_REGION":
            settings.region,

        "DYNAMODB_RETRY_MS":
            str(
                settings.dynamodb_retry_ms
            ),
    }

    if tier.name == "weather":
        common.update(
            {
                "WEATHER_TABLE":
                    settings.dynamodb_table_name,

                "NWS_USER_AGENT":
                    (
                        "itmo-444-544 final weather advisor "
                        f"({settings.contact_email})"
                    ),
            }
        )

        return common

    if tier.name == "advisor":
        if not alb_dns_name:
            raise ValueError(
                "Advisor user-data requires alb_dns_name."
            )

        common.update(
            {
                "WEATHER_URL":
                    (
                        f"http://{alb_dns_name}:"
                        f"{settings.weather.listener_port}"
                    ),

                "REPORT_TABLE":
                    settings.dynamodb_table_name,

                "GEMINI_KEY_PARAM":
                    settings.gemini_param_name,

                "GEMINI_MODEL":
                    settings.gemini_model,

                "KEY_CACHE_SECONDS":
                    str(
                        settings.key_cache_seconds
                    ),

                "GEMINI_DAILY_CAP":
                    str(
                        settings.gemini_daily_cap
                    ),

                "EMAIL_LIMIT":
                    str(
                        settings.email_limit
                    ),

                "EMAIL_LIMIT_WINDOW_SECONDS":
                    str(
                        settings
                        .email_limit_window_seconds
                    ),

                "SES_FROM_EMAIL":
                    settings.ses_from_email,

                "SES_REGION":
                    settings.ses_region,
            }
        )

        return common

    raise ValueError(
        f"Unknown tier: {tier.name}"
    )


def systemd_unit(
    tier: Tier,
    environment: dict[str, str],
) -> str:
    """Build the systemd unit for one Node application."""

    env_lines = []

    for key, value in environment.items():
        safe_value = (
            str(value)
            .replace("\\", "\\\\")
            .replace('"', '\\"')
        )

        env_lines.append(
            f'Environment="{key}={safe_value}"'
        )

    environment_block = "\n".join(
        env_lines
    )

    app_root = (
        f"{REPO_DIR}/final_project/"
        f"{tier.app_dir.name}"
    )

    return f"""[Unit]
Description={tier.name.capitalize()} Weather Advisor Service
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory={app_root}
{environment_block}
ExecStart=/usr/bin/node {app_root}/app.js
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
"""


def build_user_data(
    settings: Settings,
    tier: Tier,
    *,
    alb_dns_name: str | None = None,
) -> str:
    """Build small Python-only EC2 user-data."""

    environment = environment_for(
        settings,
        tier,
        alb_dns_name=alb_dns_name,
    )

    unit_text = systemd_unit(
        tier,
        environment,
    )

    app_root = (
        f"{REPO_DIR}/final_project/"
        f"{tier.app_dir.name}"
    )

    service_path = (
        f"/etc/systemd/system/"
        f"{tier.service_name}.service"
    )

    return f'''#!/usr/bin/env python3
import pathlib
import shutil
import subprocess


REPO_URL = {REPO_URL!r}
REPO_DIR = {REPO_DIR!r}
APP_ROOT = {app_root!r}
SERVICE_PATH = {service_path!r}
SERVICE_NAME = {tier.service_name!r}
SERVICE_TEXT = {unit_text!r}


def run(command, cwd=None):
    subprocess.run(
        command,
        cwd=cwd,
        check=True,
    )


def main():
    run(
        [
            "dnf",
            "install",
            "-y",
            "git",
            "nodejs",
        ]
    )

    repo_path = pathlib.Path(
        REPO_DIR
    )

    if repo_path.exists():
        shutil.rmtree(
            repo_path
        )

    run(
        [
            "git",
            "clone",
            "--depth",
            "1",
            REPO_URL,
            REPO_DIR,
        ]
    )

    run(
        [
            "npm",
            "install",
            "--omit=dev",
        ],
        cwd=APP_ROOT,
    )

    pathlib.Path(
        SERVICE_PATH
    ).write_text(
        SERVICE_TEXT
    )

    run(
        [
            "chown",
            "-R",
            "ec2-user:ec2-user",
            REPO_DIR,
        ]
    )

    run(
        [
            "systemctl",
            "daemon-reload",
        ]
    )

    run(
        [
            "systemctl",
            "enable",
            SERVICE_NAME,
        ]
    )

    run(
        [
            "systemctl",
            "restart",
            SERVICE_NAME,
        ]
    )


if __name__ == "__main__":
    main()
'''


def launch_template_data(
    settings: Settings,
    tier: Tier,
    *,
    alb_dns_name: str | None = None,
) -> dict:
    """Build EC2 launch-template data."""

    user_data = build_user_data(
        settings,
        tier,
        alb_dns_name=alb_dns_name,
    )

    return {
        "ImageId":
            settings.ami_id,

        "InstanceType":
            settings.instance_type,

        "KeyName":
            settings.key_name,

        "SecurityGroupIds": [
            settings.app_security_group_id
        ],

        "IamInstanceProfile": {
            "Name":
                tier.profile_name
        },

        "UserData":
            base64.b64encode(
                user_data.encode(
                    "utf-8"
                )
            ).decode(
                "ascii"
            ),

        "TagSpecifications": [
            {
                "ResourceType":
                    "instance",

                "Tags": [
                    {
                        "Key":
                            "Name",

                        "Value":
                            f"{tier.name}-app",
                    },
                    {
                        "Key":
                            "Project",

                        "Value":
                            "WeatherAdvisorFinal",
                    },
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
            code
            ==
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
) -> int:
    """Create the launch template or publish a new version."""

    data = launch_template_data(
        settings,
        tier,
        alb_dns_name=alb_dns_name,
    )

    if not launch_template_exists(
        aws,
        tier,
    ):
        response = (
            aws.ec2
            .create_launch_template(
                LaunchTemplateName=
                    tier.lt_name,

                LaunchTemplateData=
                    data,

                TagSpecifications=[
                    {
                        "ResourceType":
                            "launch-template",

                        "Tags": [
                            {
                                "Key":
                                    "Project",

                                "Value":
                                    "WeatherAdvisorFinal",
                            }
                        ],
                    }
                ],
            )
        )

        version = (
            response
            ["LaunchTemplate"]
            ["LatestVersionNumber"]
        )

        log.info(
            "Created launch template %s version %s.",
            tier.lt_name,
            version,
        )

        return int(version)

    response = (
        aws.ec2
        .create_launch_template_version(
            LaunchTemplateName=
                tier.lt_name,

            LaunchTemplateData=
                data,
        )
    )

    version = (
        response
        ["LaunchTemplateVersion"]
        ["VersionNumber"]
    )

    aws.ec2.modify_launch_template(
        LaunchTemplateName=
            tier.lt_name,

        DefaultVersion=
            str(version),
    )

    log.info(
        "Launch template %s published version %s.",
        tier.lt_name,
        version,
    )

    return int(version)


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
        LaunchTemplateName=
            tier.lt_name
    )

    log.info(
        "Deleted launch template %s.",
        tier.lt_name,
    )
