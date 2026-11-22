"""Create and delete the final Weather Advisor application stack."""

from __future__ import annotations

import json
import logging
import time

from botocore.exceptions import ClientError

from stack import balancer, compute, network, scaling, storage
from stack.clients import AwsClients
from stack.config import Settings, Tier
from stack.outputs import StackOutputs
from stack.policies import policy_for, trust_policy


log = logging.getLogger("stack")


def role_exists(
    aws: AwsClients,
    role_name: str,
) -> bool:
    """Return True when an IAM role exists."""

    try:
        aws.iam.get_role(
            RoleName=role_name
        )
        return True

    except ClientError as err:
        code = (
            err.response
            .get("Error", {})
            .get("Code")
        )

        if code == "NoSuchEntity":
            return False

        raise


def profile_exists(
    aws: AwsClients,
    profile_name: str,
) -> bool:
    """Return True when an instance profile exists."""

    try:
        aws.iam.get_instance_profile(
            InstanceProfileName=profile_name
        )
        return True

    except ClientError as err:
        code = (
            err.response
            .get("Error", {})
            .get("Code")
        )

        if code == "NoSuchEntity":
            return False

        raise


def ensure_role_and_profile(
    aws: AwsClients,
    settings: Settings,
    tier: Tier,
    account_id: str,
) -> None:
    """Create/update the EC2 role and instance profile."""

    if not role_exists(
        aws,
        tier.role_name,
    ):
        aws.iam.create_role(
            RoleName=tier.role_name,

            AssumeRolePolicyDocument=json.dumps(
                trust_policy()
            ),

            Tags=[
                {
                    "Key": "Project",
                    "Value": "WeatherAdvisorFinal",
                }
            ],
        )

        log.info(
            "Created IAM role %s.",
            tier.role_name,
        )

    if not profile_exists(
        aws,
        tier.profile_name,
    ):
        aws.iam.create_instance_profile(
            InstanceProfileName=
                tier.profile_name,

            Tags=[
                {
                    "Key": "Project",
                    "Value": "WeatherAdvisorFinal",
                }
            ],
        )

        log.info(
            "Created instance profile %s.",
            tier.profile_name,
        )

    profile = (
        aws.iam
        .get_instance_profile(
            InstanceProfileName=
                tier.profile_name
        )["InstanceProfile"]
    )

    attached_roles = {
        role["RoleName"]
        for role
        in profile.get(
            "Roles",
            [],
        )
    }

    if tier.role_name not in attached_roles:
        aws.iam.add_role_to_instance_profile(
            InstanceProfileName=
                tier.profile_name,

            RoleName=
                tier.role_name,
        )

    document = policy_for(
        tier_name=tier.name,
        region=settings.region,
        account_id=account_id,
        table_name=
            settings.dynamodb_table_name,
        gemini_parameter=
            settings.gemini_param_name,
        ses_from_email=
            settings.ses_from_email,
    )

    aws.iam.put_role_policy(
        RoleName=tier.role_name,
        PolicyName=tier.policy_name,
        PolicyDocument=json.dumps(
            document
        ),
    )

    log.info(
        "Applied least-privilege policy to %s.",
        tier.role_name,
    )


def delete_role_and_profile(
    aws: AwsClients,
    tier: Tier,
) -> None:
    """Delete one tier's IAM role and profile."""

    if profile_exists(
        aws,
        tier.profile_name,
    ):
        try:
            aws.iam.remove_role_from_instance_profile(
                InstanceProfileName=
                    tier.profile_name,

                RoleName=
                    tier.role_name,
            )

        except ClientError as err:
            code = (
                err.response
                .get("Error", {})
                .get("Code")
            )

            if code != "NoSuchEntity":
                raise

        aws.iam.delete_instance_profile(
            InstanceProfileName=
                tier.profile_name
        )

    if role_exists(
        aws,
        tier.role_name,
    ):
        try:
            aws.iam.delete_role_policy(
                RoleName=
                    tier.role_name,

                PolicyName=
                    tier.policy_name,
            )

        except ClientError as err:
            code = (
                err.response
                .get("Error", {})
                .get("Code")
            )

            if code != "NoSuchEntity":
                raise

        aws.iam.delete_role(
            RoleName=
                tier.role_name
        )

    log.info(
        "Deleted IAM resources for %s.",
        tier.name,
    )


def check_gemini_parameter(
    aws: AwsClients,
    settings: Settings,
) -> None:
    """Verify the Gemini SecureString exists."""

    try:
        aws.ssm.get_parameter(
            Name=
                settings.gemini_param_name
        )

    except aws.ssm.exceptions.ParameterNotFound:
        raise RuntimeError(
            "Gemini SSM parameter does not exist: "
            f"{settings.gemini_param_name}"
        )


def check_ses_sender(
    aws: AwsClients,
    settings: Settings,
) -> None:
    """Verify the configured SES sender identity exists."""

    try:
        response = (
            aws.sesv2
            .get_email_identity(
                EmailIdentity=
                    settings.ses_from_email
            )
        )

    except aws.sesv2.exceptions.NotFoundException:
        raise RuntimeError(
            "SES sender identity does not exist: "
            f"{settings.ses_from_email}"
        )

    if not response.get(
        "VerifiedForSendingStatus",
        False,
    ):
        raise RuntimeError(
            "SES sender identity exists but is not "
            "verified for sending: "
            f"{settings.ses_from_email}"
        )


def create_stack(
    settings: Settings,
    aws: AwsClients,
    iam_wait: int = 15,
    sleep=time.sleep,
) -> StackOutputs:
    """Create the complete final Weather Advisor stack."""

    log.info(
        "== 1. Checking prerequisites =="
    )

    check_gemini_parameter(
        aws,
        settings,
    )

    check_ses_sender(
        aws,
        settings,
    )

    account_id = (
        aws.sts
        .get_caller_identity()
        ["Account"]
    )

    log.info(
        "== 2. DynamoDB storage =="
    )

    storage.ensure_table(
        aws,
        settings,
    )

    log.info(
        "== 3. IAM roles and profiles =="
    )

    for tier in settings.tiers:
        ensure_role_and_profile(
            aws,
            settings,
            tier,
            account_id,
        )

    log.info(
        "Waiting %ss for IAM propagation...",
        iam_wait,
    )

    sleep(iam_wait)

    log.info(
        "== 4. Network =="
    )

    vpc_id = network.default_vpc_id(
        aws
    )

    subnet_a = network.subnet_in_az(
        aws,
        vpc_id,
        settings.az_a,
    )

    subnet_b = network.subnet_in_az(
        aws,
        vpc_id,
        settings.az_b,
    )

    alb_sg_id = (
        network
        .ensure_alb_security_group(
            aws,
            settings,
            vpc_id,
        )
    )

    network.restrict_app_security_group(
        aws,
        settings,
        alb_sg_id,
    )

    log.info(
        "== 5. Target groups =="
    )

    tg_arns = {
        tier.name:
            balancer.ensure_target_group(
                aws,
                settings,
                tier,
                vpc_id,
            )
        for tier in settings.tiers
    }

    log.info(
        "== 6. Load balancer =="
    )

    alb_arn, alb_dns = (
        balancer.ensure_load_balancer(
            aws,
            settings,
            [
                subnet_a,
                subnet_b,
            ],
            alb_sg_id,
        )
    )

    log.info(
        "== 7. Listeners =="
    )

    for tier in settings.tiers:
        balancer.ensure_listener(
            aws,
            alb_arn,
            tier.listener_port,
            tg_arns[tier.name],
        )

    log.info(
        "== 8. Launch templates =="
    )

    compute.ensure_launch_template(
        aws,
        settings,
        settings.weather,
    )

    compute.ensure_launch_template(
        aws,
        settings,
        settings.advisor,
        alb_dns_name=alb_dns,
    )

    log.info(
        "== 9. Auto Scaling Groups =="
    )

    for tier in settings.tiers:
        scaling.ensure_asg(
            aws,
            tier,
            tg_arns[tier.name],
            [
                subnet_a,
                subnet_b,
            ],
        )

    outputs = StackOutputs(
        vpc_id=vpc_id,
        subnet_a=subnet_a,
        subnet_b=subnet_b,
        alb_security_group_id=
            alb_sg_id,
        alb_arn=alb_arn,
        alb_dns_name=alb_dns,
        weather_tg_arn=
            tg_arns["weather"],
        advisor_tg_arn=
            tg_arns["advisor"],
    )

    outputs.save()

    log.info(
        "Weather URL: http://%s:%s/weather",
        alb_dns,
        settings.weather.listener_port,
    )

    log.info(
        "Advisor URL: http://%s:%s/",
        alb_dns,
        settings.advisor.listener_port,
    )

    return outputs


def delete_stack(
    settings: Settings,
    aws: AwsClients,
    sleep=time.sleep,
) -> None:
    """Delete the final-project application stack."""

    log.info(
        "== 1. Auto Scaling Groups =="
    )

    for tier in settings.tiers:
        scaling.delete_asg(
            aws,
            tier.asg_name,
            sleep=sleep,
        )

    log.info(
        "== 2. Load balancer =="
    )

    balancer.delete_load_balancer(
        aws,
        settings.alb_name,
    )

    log.info(
        "== 3. Target groups =="
    )

    for tier in settings.tiers:
        balancer.delete_target_group(
            aws,
            tier.tg_name,
        )

    log.info(
        "== 4. Security groups =="
    )

    vpc_id = network.default_vpc_id(
        aws
    )

    alb_sg_id = (
        network.find_security_group(
            aws,
            settings.alb_sg_name,
            vpc_id,
        )
    )

    network.restore_app_security_group(
        aws,
        settings,
        alb_sg_id,
    )

    if alb_sg_id:
        network.delete_alb_security_group(
            aws,
            alb_sg_id,
        )

    log.info(
        "== 5. Launch templates =="
    )

    for tier in settings.tiers:
        compute.delete_launch_template(
            aws,
            tier,
        )

    log.info(
        "== 6. IAM roles and profiles =="
    )

    for tier in settings.tiers:
        delete_role_and_profile(
            aws,
            tier,
        )

    log.info(
        "== 7. DynamoDB =="
    )

    storage.delete_table(
        aws,
        settings,
        sleep=sleep,
    )

    StackOutputs.remove()

    log.info(
        "Final Weather Advisor stack cleanup complete."
    )

    log.info(
        "Gemini SSM parameter was preserved."
    )

    log.info(
        "SES identities were preserved."
    )
