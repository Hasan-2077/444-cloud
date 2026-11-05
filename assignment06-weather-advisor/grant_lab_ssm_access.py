"""Grant the lab IAM user least-privilege access to its SSM parameters."""

from __future__ import annotations

import json

import boto3


USER_NAME = "hasan-user"
AWS_REGION = "us-east-2"
ACCOUNT_ID = "133857166309"
POLICY_NAME = "itmo-444-544-ssm-parameter-access"

PARAMETER_ARN = (
    f"arn:aws:ssm:{AWS_REGION}:{ACCOUNT_ID}:parameter/itmo-444-544/*"
)


def main() -> None:
    iam = boto3.client("iam")

    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "ssm:PutParameter",
                    "ssm:GetParameter",
                    "ssm:DeleteParameter",
                ],
                "Resource": PARAMETER_ARN,
            },
            {
                "Effect": "Allow",
                "Action": [
                    "ssm:DescribeParameters",
                ],
                "Resource": "*",
            },
        ],
    }

    iam.put_user_policy(
        UserName=USER_NAME,
        PolicyName=POLICY_NAME,
        PolicyDocument=json.dumps(policy),
    )

    print(f"Added inline policy: {POLICY_NAME}")
    print(f"SSM parameter scope: {PARAMETER_ARN}")


if __name__ == "__main__":
    main()
