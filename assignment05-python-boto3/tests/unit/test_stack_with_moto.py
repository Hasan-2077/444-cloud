"""Run the real create and delete code against moto, an in-memory fake of AWS.

Nothing here touches your AWS account, costs money, or needs credentials.
"""
import json

import pytest
from moto import mock_aws

from stack.clients import AwsClients
from stack.config import Settings
from stack.runner import create_stack, delete_stack
from tests.conftest import FAKE_VALUES


@pytest.fixture
def env(tmp_path, monkeypatch, fake_settings):
    """A fake AWS account with the things lab03 would already have created."""

    monkeypatch.chdir(tmp_path)

    with mock_aws():
        aws = AwsClients.create("us-east-2")

        vpc = aws.ec2.describe_vpcs(
            Filters=[
                {
                    "Name": "isDefault",
                    "Values": ["true"]
                }
            ]
        )["Vpcs"][0]

        sg = aws.ec2.create_security_group(
            GroupName="app-sg",
            Description="app",
            VpcId=vpc["VpcId"]
        )["GroupId"]

        aws.ec2.authorize_security_group_ingress(
            GroupId=sg,
            IpPermissions=[{
                "IpProtocol": "tcp",
                "FromPort": 3000,
                "ToPort": 3000,
                "IpRanges": [
                    {
                        "CidrIp": "0.0.0.0/0"
                    }
                ]
            }]
        )

        aws.ec2.create_key_pair(
            KeyName="test-key"
        )

        ami = aws.ec2.describe_images()[
            "Images"
        ][0]["ImageId"]

        values = dict(
            FAKE_VALUES,
            APP_SECURITY_GROUP_ID=sg,
            AMI_ID=ami
        )

        settings = Settings.from_values(
            values,
            base_dir=fake_settings.uploader.app_dir.parent.parent
        )

        yield settings, aws


def _app_sg_rules(aws, settings):
    group = aws.ec2.describe_security_groups(
        GroupIds=[settings.app_sg_id]
    )["SecurityGroups"][0]

    return [
        p
        for p in group["IpPermissions"]
        if p.get("FromPort") == 3000
    ]


def test_create_builds_every_resource(env):
    settings, aws = env

    outputs = create_stack(
        settings,
        aws,
        iam_wait=0
    )

    aws.s3.head_bucket(
        Bucket=settings.bucket_name
    )

    block = aws.s3.get_public_access_block(
        Bucket=settings.bucket_name
    )["PublicAccessBlockConfiguration"]

    assert all(block.values())

    for tier in settings.tiers:
        role_policy = aws.iam.get_role_policy(
            RoleName=tier.role_name,
            PolicyName=tier.policy_name
        )

        assert role_policy[
            "PolicyDocument"
        ]["Statement"]

        profile = aws.iam.get_instance_profile(
            InstanceProfileName=tier.profile_name
        )

        assert [
            r["RoleName"]
            for r in profile[
                "InstanceProfile"
            ]["Roles"]
        ] == [
            tier.role_name
        ]

        assert aws.ec2.describe_launch_templates(
            LaunchTemplateNames=[
                tier.lt_name
            ]
        )["LaunchTemplates"]

        group = aws.autoscaling.describe_auto_scaling_groups(
            AutoScalingGroupNames=[
                tier.asg_name
            ]
        )["AutoScalingGroups"][0]

        assert (
            group["MinSize"],
            group["MaxSize"],
            group["DesiredCapacity"]
        ) == (
            1,
            1,
            1
        )

        assert group[
            "HealthCheckType"
        ] == "ELB"

        tg = aws.elbv2.describe_target_groups(
            Names=[
                tier.tg_name
            ]
        )["TargetGroups"][0]

        assert tg[
            "HealthCheckIntervalSeconds"
        ] == 10


def test_app_port_is_restricted_to_alb(env):
    settings, aws = env

    outputs = create_stack(
        settings,
        aws,
        iam_wait=0
    )

    rules = _app_sg_rules(
        aws,
        settings
    )

    assert rules

    for rule in rules:
        assert rule["IpRanges"] == []

        assert [
            pair["GroupId"]
            for pair in rule[
                "UserIdGroupPairs"
            ]
        ] == [
            outputs.alb_security_group_id
        ]


def test_asgs_span_both_subnets(env):
    settings, aws = env

    outputs = create_stack(
        settings,
        aws,
        iam_wait=0
    )

    expected = {
        outputs.subnet_a,
        outputs.subnet_b,
    }

    for tier in settings.tiers:
        group = aws.autoscaling.describe_auto_scaling_groups(
            AutoScalingGroupNames=[
                tier.asg_name
            ]
        )["AutoScalingGroups"][0]

        actual = set(
            group[
                "VPCZoneIdentifier"
            ].split(",")
        )

        assert actual == expected


def test_target_groups_are_attached_to_asgs(env):
    settings, aws = env

    outputs = create_stack(
        settings,
        aws,
        iam_wait=0
    )

    for tier in settings.tiers:
        group = aws.autoscaling.describe_auto_scaling_groups(
            AutoScalingGroupNames=[
                tier.asg_name
            ]
        )["AutoScalingGroups"][0]

        assert outputs.tg_arn(
            tier.name
        ) in group["TargetGroupARNs"]


def test_create_is_idempotent(env):
    settings, aws = env

    first = create_stack(
        settings,
        aws,
        iam_wait=0
    )

    second = create_stack(
        settings,
        aws,
        iam_wait=0
    )

    assert first.vpc_id == second.vpc_id
    assert first.subnet_a == second.subnet_a
    assert first.subnet_b == second.subnet_b

    assert first.alb_dns_name == second.alb_dns_name


def test_delete_removes_resources(env):
    settings, aws = env

    create_stack(
        settings,
        aws,
        iam_wait=0
    )

    delete_stack(
        settings,
        aws,
        sleep=lambda _: None
    )

    assert aws.autoscaling.describe_auto_scaling_groups(
        AutoScalingGroupNames=[
            settings.uploader.asg_name,
            settings.viewer.asg_name
        ]
    )["AutoScalingGroups"] == []

    assert aws.elbv2.describe_load_balancers()[
        "LoadBalancers"
    ] == []

    assert aws.iam.list_roles()[
        "Roles"
    ] == []


def test_delete_is_safe_to_repeat(env):
    settings, aws = env

    create_stack(
        settings,
        aws,
        iam_wait=0
    )

    delete_stack(
        settings,
        aws,
        sleep=lambda _: None
    )

    delete_stack(
        settings,
        aws,
        sleep=lambda _: None
    )
