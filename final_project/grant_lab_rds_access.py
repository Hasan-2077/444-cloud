"""Grant the lab IAM user the RDS permissions needed for Assignment 6."""

from __future__ import annotations

import json

import boto3


USER_NAME = "hasan-user"
POLICY_NAME = "itmo-444-544-rds-access"

AWS_REGION = "us-east-2"
ACCOUNT_ID = "133857166309"


def main() -> None:
    iam = boto3.client("iam")

    policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "rds:CreateDBInstance",
                    "rds:DescribeDBInstances",
                    "rds:DeleteDBInstance",
                    "rds:CreateDBSubnetGroup",
                    "rds:DescribeDBSubnetGroups",
                    "rds:DeleteDBSubnetGroup",
                    "rds:DescribeDBSnapshots",
                    "rds:DescribeDBInstanceAutomatedBackups",
                ],
                "Resource": "*",
            }
        ],
    }

    iam.put_user_policy(
        UserName=USER_NAME,
        PolicyName=POLICY_NAME,
        PolicyDocument=json.dumps(policy),
    )

    print(f"Added inline policy: {POLICY_NAME}")


if __name__ == "__main__":
    main()
