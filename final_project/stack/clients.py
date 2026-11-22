"""AWS clients used by the final Weather Advisor stack."""

from __future__ import annotations

from dataclasses import dataclass

import boto3


@dataclass
class AwsClients:
    """Container for boto3 clients used by the final project."""

    iam: object
    ec2: object
    elbv2: object
    autoscaling: object
    sts: object
    ssm: object
    dynamodb: object
    sesv2: object

    @classmethod
    def create(
        cls,
        region: str,
    ) -> "AwsClients":
        """Create all required AWS clients in one region."""

        session = boto3.Session(
            region_name=region
        )

        return cls(
            iam=session.client("iam"),
            ec2=session.client("ec2"),
            elbv2=session.client("elbv2"),
            autoscaling=session.client(
                "autoscaling"
            ),
            sts=session.client("sts"),
            ssm=session.client("ssm"),
            dynamodb=session.client(
                "dynamodb"
            ),
            sesv2=session.client(
                "sesv2"
            ),
        )
