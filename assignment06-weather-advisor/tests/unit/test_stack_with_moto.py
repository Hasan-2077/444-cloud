"""In-memory AWS tests for the Assignment 6 Weather Advisor stack."""

import pytest
from moto import mock_aws

from stack.clients import AwsClients
from stack.config import Settings
from stack.runner import create_stack, delete_stack
from tests.conftest import FAKE_VALUES


@pytest.fixture
def env(tmp_path, monkeypatch, fake_settings):
    """Create the AWS prerequisites expected by Assignment 6."""

    monkeypatch.chdir(tmp_path)

    with mock_aws():
        aws = AwsClients.create("us-east-2")

        # Default VPC supplied by moto.
        vpc = aws.ec2.describe_vpcs(
            Filters=[
                {
                    "Name": "isDefault",
                    "Values": ["true"],
                }
            ]
        )["Vpcs"][0]

        # Existing application SG, matching the real assignment setup.
        sg_id = aws.ec2.create_security_group(
            GroupName="app-sg",
            Description="application security group",
            VpcId=vpc["VpcId"],
        )["GroupId"]

        # Begin with app port open. create_stack() should restrict this
        # so only the ALB security group can reach port 3000.
        aws.ec2.authorize_security_group_ingress(
            GroupId=sg_id,
            IpPermissions=[
                {
                    "IpProtocol": "tcp",
                    "FromPort": 3000,
                    "ToPort": 3000,
                    "IpRanges": [
                        {
                            "CidrIp": "0.0.0.0/0",
                        }
                    ],
                }
            ],
        )

        # Launch templates require the configured key pair and AMI.
        aws.ec2.create_key_pair(
            KeyName="test-key",
        )

        ami = aws.ec2.describe_images()["Images"][0]["ImageId"]

        values = dict(
            FAKE_VALUES,
            APP_SECURITY_GROUP_ID=sg_id,
            AMI_ID=ami,
        )

        settings = Settings.from_values(
            values,
            base_dir=tmp_path,
        )

        # create_stack() checks that the Gemini key exists.
        aws.ssm.put_parameter(
            Name=settings.gemini_param_name,
            Description="test Gemini key",
            Value="fake-gemini-key",
            Type="SecureString",
        )

        # create_stack() also expects the database creation step
        # to have already produced db_outputs.env.
        (tmp_path / "db_outputs.env").write_text(
            "DB_HOST=test-db.example.amazonaws.com\n"
        )

        yield settings, aws


def _app_port_rules(aws, settings):
    group = aws.ec2.describe_security_groups(
        GroupIds=[
            settings.app_security_group_id,
        ]
    )["SecurityGroups"][0]

    return [
        permission
        for permission in group["IpPermissions"]
        if permission.get("FromPort") == settings.app_port
        and permission.get("ToPort") == settings.app_port
    ]


def test_create_builds_every_resource(env):
    settings, aws = env

    outputs = create_stack(
        settings,
        aws,
        iam_wait=0,
        sleep=lambda _: None,
    )

    assert outputs.vpc_id
    assert outputs.subnet_a
    assert outputs.subnet_b
    assert outputs.alb_arn
    assert outputs.alb_dns_name
    assert outputs.alb_security_group_id
    assert outputs.weather_tg_arn
    assert outputs.advisor_tg_arn

    for tier in settings.tiers:
        role = aws.iam.get_role(
            RoleName=tier.role_name,
        )

        assert role["Role"]["RoleName"] == tier.role_name

        profile = aws.iam.get_instance_profile(
            InstanceProfileName=tier.profile_name,
        )["InstanceProfile"]

        assert tier.role_name in {
            role["RoleName"]
            for role in profile.get("Roles", [])
        }

        templates = aws.ec2.describe_launch_templates(
            LaunchTemplateNames=[
                tier.lt_name,
            ]
        )["LaunchTemplates"]

        assert len(templates) == 1

        groups = aws.autoscaling.describe_auto_scaling_groups(
            AutoScalingGroupNames=[
                tier.asg_name,
            ]
        )["AutoScalingGroups"]

        assert len(groups) == 1

        group = groups[0]

        assert group["MinSize"] == 1
        assert group["MaxSize"] == 1
        assert group["DesiredCapacity"] == 1
        assert group["HealthCheckType"] == "ELB"


def test_app_port_is_restricted_to_alb(env):
    settings, aws = env

    outputs = create_stack(
        settings,
        aws,
        iam_wait=0,
        sleep=lambda _: None,
    )

    rules = _app_port_rules(
        aws,
        settings,
    )

    assert rules

    for rule in rules:
        assert rule.get("IpRanges", []) == []

        source_groups = {
            pair["GroupId"]
            for pair in rule.get(
                "UserIdGroupPairs",
                [],
            )
        }

        assert source_groups == {
            outputs.alb_security_group_id,
        }


def test_asgs_span_both_subnets(env):
    settings, aws = env

    outputs = create_stack(
        settings,
        aws,
        iam_wait=0,
        sleep=lambda _: None,
    )

    expected = {
        outputs.subnet_a,
        outputs.subnet_b,
    }

    for tier in settings.tiers:
        group = aws.autoscaling.describe_auto_scaling_groups(
            AutoScalingGroupNames=[
                tier.asg_name,
            ]
        )["AutoScalingGroups"][0]

        actual = set(
            group["VPCZoneIdentifier"].split(",")
        )

        assert actual == expected


def test_target_groups_are_attached_to_asgs(env):
    settings, aws = env

    outputs = create_stack(
        settings,
        aws,
        iam_wait=0,
        sleep=lambda _: None,
    )

    expected_tgs = {
        "weather": outputs.weather_tg_arn,
        "advisor": outputs.advisor_tg_arn,
    }

    for tier in settings.tiers:
        group = aws.autoscaling.describe_auto_scaling_groups(
            AutoScalingGroupNames=[
                tier.asg_name,
            ]
        )["AutoScalingGroups"][0]

        assert (
            expected_tgs[tier.name]
            in group["TargetGroupARNs"]
        )


def test_create_is_idempotent(env):
    settings, aws = env

    first = create_stack(
        settings,
        aws,
        iam_wait=0,
        sleep=lambda _: None,
    )

    second = create_stack(
        settings,
        aws,
        iam_wait=0,
        sleep=lambda _: None,
    )

    assert first.vpc_id == second.vpc_id
    assert first.subnet_a == second.subnet_a
    assert first.subnet_b == second.subnet_b
    assert first.alb_dns_name == second.alb_dns_name
    assert first.weather_tg_arn == second.weather_tg_arn
    assert first.advisor_tg_arn == second.advisor_tg_arn


def test_delete_removes_resources(env):
    settings, aws = env

    create_stack(
        settings,
        aws,
        iam_wait=0,
        sleep=lambda _: None,
    )

    delete_stack(
        settings,
        aws,
        sleep=lambda _: None,
    )

    groups = aws.autoscaling.describe_auto_scaling_groups(
        AutoScalingGroupNames=[
            settings.weather.asg_name,
            settings.advisor.asg_name,
        ]
    )["AutoScalingGroups"]

    assert groups == []

    load_balancers = aws.elbv2.describe_load_balancers()[
        "LoadBalancers"
    ]

    assert load_balancers == []

    for tier in settings.tiers:
        templates = aws.ec2.describe_launch_templates(
            Filters=[
                {
                    "Name": "launch-template-name",
                    "Values": [
                        tier.lt_name,
                    ],
                }
            ]
        )["LaunchTemplates"]

        assert templates == []

        roles = aws.iam.list_roles()["Roles"]

        assert tier.role_name not in {
            role["RoleName"]
            for role in roles
        }


def test_delete_is_safe_to_repeat(env):
    settings, aws = env

    create_stack(
        settings,
        aws,
        iam_wait=0,
        sleep=lambda _: None,
    )

    delete_stack(
        settings,
        aws,
        sleep=lambda _: None,
    )

    # Running cleanup again must not raise an exception.
    delete_stack(
        settings,
        aws,
        sleep=lambda _: None,
    )
