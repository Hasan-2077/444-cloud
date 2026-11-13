"""Grant the current lab IAM user access to Lab07 SSM parameters."""

from __future__ import annotations

import json

import boto3


AWS_REGION = "us-east-2"
POLICY_NAME = "itmo-444-544-lab07-ssm-parameter-access"
PARAMETER_PREFIX = "/itmo-444-544-lab07/"


def current_iam_user_name() -> str:
    """Get the IAM user name from the currently authenticated AWS identity."""
    sts = boto3.client("sts", region_name=AWS_REGION)
    identity = sts.get_caller_identity()

    arn = identity["Arn"]

    if ":user/" not in arn:
        raise RuntimeError(
            f"Current AWS identity is not an IAM user: {arn}"
        )

    return arn.split(":user/", 1)[1]


def main() -> None:
    sts = boto3.client("sts", region_name=AWS_REGION)
    iam = boto3.client("iam", region_name=AWS_REGION)

    identity = sts.get_caller_identity()
    account_id = identity["Account"]
    user_name = current_iam_user_name()

    parameter_arn = (
        f"arn:aws:ssm:{AWS_REGION}:{account_id}:"
        f"parameter{PARAMETER_PREFIX}*"
    )

    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "ManageLab07Parameters",
                "Effect": "Allow",
                "Action": [
                    "ssm:PutParameter",
                    "ssm:GetParameter",
                    "ssm:GetParameters",
                    "ssm:GetParameterHistory",
                    "ssm:DeleteParameter",
                    "ssm:AddTagsToResource",
                    "ssm:RemoveTagsFromResource",
                    "ssm:ListTagsForResource",
                ],
                "Resource": parameter_arn,
            },
            {
                "Sid": "DescribeParameters",
                "Effect": "Allow",
                "Action": [
                    "ssm:DescribeParameters",
                ],
                "Resource": "*",
            },
        ],
    }

    iam.put_user_policy(
        UserName=user_name,
        PolicyName=POLICY_NAME,
        PolicyDocument=json.dumps(policy),
    )

    print(f"Updated inline policy: {POLICY_NAME}")
    print(f"IAM user: {user_name}")
    print(f"SSM parameter scope: {parameter_arn}")
    print("Allowed Terraform SSM create/read/tag/update/delete operations.")


if __name__ == "__main__":
    main()
