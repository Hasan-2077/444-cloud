"""Networking helpers for the Assignment 6 stack."""

from __future__ import annotations

import logging
import time

from botocore.exceptions import ClientError

from stack.clients import AwsClients
from stack.config import Settings


log = logging.getLogger("stack")


class StackError(Exception):
    """Raised when a required network resource cannot be found."""


def default_vpc_id(
    aws: AwsClients,
) -> str:
    """Return the default VPC ID."""

    vpcs = aws.ec2.describe_vpcs(
        Filters=[
            {
                "Name": "isDefault",
                "Values": ["true"],
            }
        ]
    )["Vpcs"]

    if not vpcs:
        raise StackError(
            "No default VPC found in this region."
        )

    return vpcs[0]["VpcId"]


def subnet_in_az(
    aws: AwsClients,
    vpc_id: str,
    az: str,
) -> str:
    """Return one subnet in the requested availability zone."""

    subnets = aws.ec2.describe_subnets(
        Filters=[
            {
                "Name": "vpc-id",
                "Values": [vpc_id],
            },
            {
                "Name": "availability-zone",
                "Values": [az],
            },
        ]
    )["Subnets"]

    if not subnets:
        raise StackError(
            f"No subnet found in {az}."
        )

    return subnets[0]["SubnetId"]


def cidr_rule(
    port: int,
    cidr: str = "0.0.0.0/0",
) -> list[dict]:
    """Build one TCP CIDR ingress rule."""

    return [
        {
            "IpProtocol": "tcp",
            "FromPort": port,
            "ToPort": port,
            "IpRanges": [
                {
                    "CidrIp": cidr,
                }
            ],
        }
    ]


def group_rule(
    port: int,
    group_id: str,
) -> list[dict]:
    """Build one TCP security-group-source rule."""

    return [
        {
            "IpProtocol": "tcp",
            "FromPort": port,
            "ToPort": port,
            "UserIdGroupPairs": [
                {
                    "GroupId": group_id,
                }
            ],
        }
    ]


def find_security_group(
    aws: AwsClients,
    name: str,
    vpc_id: str,
) -> str | None:
    """Find a security group by name inside a VPC."""

    groups = aws.ec2.describe_security_groups(
        Filters=[
            {
                "Name": "group-name",
                "Values": [name],
            },
            {
                "Name": "vpc-id",
                "Values": [vpc_id],
            },
        ]
    )["SecurityGroups"]

    if not groups:
        return None

    return groups[0]["GroupId"]


def ensure_alb_security_group(
    aws: AwsClients,
    settings: Settings,
    vpc_id: str,
) -> str:
    """Create the ALB security group and listener rules."""

    group_id = find_security_group(
        aws,
        settings.alb_sg_name,
        vpc_id,
    )

    if group_id is None:
        response = aws.ec2.create_security_group(
            GroupName=settings.alb_sg_name,
            Description="Public ALB access for Weather Advisor",
            VpcId=vpc_id,
        )

        group_id = response["GroupId"]

        log.info(
            "Created ALB security group %s",
            group_id,
        )

    for tier in settings.tiers:
        try:
            aws.ec2.authorize_security_group_ingress(
                GroupId=group_id,
                IpPermissions=cidr_rule(
                    tier.listener_port,
                    "0.0.0.0/0",
                ),
            )

        except ClientError as err:
            code = (
                err.response
                .get("Error", {})
                .get("Code")
            )

            if code != "InvalidPermission.Duplicate":
                raise

    return group_id


def restrict_app_security_group(
    aws: AwsClients,
    settings: Settings,
    alb_sg_id: str,
) -> None:
    """Allow app port only from the ALB security group."""

    try:
        aws.ec2.revoke_security_group_ingress(
            GroupId=settings.app_security_group_id,
            IpPermissions=cidr_rule(
                settings.app_port,
                "0.0.0.0/0",
            ),
        )

    except ClientError as err:
        code = (
            err.response
            .get("Error", {})
            .get("Code")
        )

        if code != "InvalidPermission.NotFound":
            raise

    try:
        aws.ec2.authorize_security_group_ingress(
            GroupId=settings.app_security_group_id,
            IpPermissions=group_rule(
                settings.app_port,
                alb_sg_id,
            ),
        )

    except ClientError as err:
        code = (
            err.response
            .get("Error", {})
            .get("Code")
        )

        if code != "InvalidPermission.Duplicate":
            raise


def restore_app_security_group(
    aws: AwsClients,
    settings: Settings,
    alb_sg_id: str | None,
) -> None:
    """Restore public app-port access during cleanup."""

    if alb_sg_id:
        try:
            aws.ec2.revoke_security_group_ingress(
                GroupId=settings.app_security_group_id,
                IpPermissions=group_rule(
                    settings.app_port,
                    alb_sg_id,
                ),
            )

        except ClientError as err:
            code = (
                err.response
                .get("Error", {})
                .get("Code")
            )

            if code != "InvalidPermission.NotFound":
                raise

    try:
        aws.ec2.authorize_security_group_ingress(
            GroupId=settings.app_security_group_id,
            IpPermissions=cidr_rule(
                settings.app_port,
                "0.0.0.0/0",
            ),
        )

    except ClientError as err:
        code = (
            err.response
            .get("Error", {})
            .get("Code")
        )

        if code != "InvalidPermission.Duplicate":
            raise


def delete_alb_security_group(
    aws: AwsClients,
    group_id: str,
) -> None:
    """Delete the ALB security group after ENIs disappear."""

    for attempt in range(1, 11):
        try:
            aws.ec2.delete_security_group(
                GroupId=group_id
            )

            log.info(
                "Deleted ALB security group %s",
                group_id,
            )

            return

        except ClientError as err:
            code = (
                err.response
                .get("Error", {})
                .get("Code")
            )

            if code == "InvalidGroup.NotFound":
                return

            if code == "DependencyViolation":
                log.info(
                    "ALB security group still in use "
                    "(attempt %s/10)",
                    attempt,
                )

                time.sleep(15)
                continue

            raise

    raise StackError(
        "ALB security group could not be deleted."
    )

