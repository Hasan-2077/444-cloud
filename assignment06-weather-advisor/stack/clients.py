"""AWS clients used by the Assignment 6 stack."""

from __future__ import annotations

from dataclasses import dataclass

import boto3


@dataclass
class AwsClients:
    """Container for the boto3 clients used by the stack."""

    s3: object
    iam: object
    ec2: object
    elbv2: object
    autoscaling: object
    sts: object
    ssm: object
    rds: object

    @classmethod
    def create(
        cls,
        region: str,
    ) -> "AwsClients":
        """Create all AWS clients in one region."""

        session = boto3.Session(
            region_name=region
        )

        return cls(
            s3=session.client("s3"),
            iam=session.client("iam"),
            ec2=session.client("ec2"),
            elbv2=session.client("elbv2"),
            autoscaling=session.client(
                "autoscaling"
            ),
            sts=session.client("sts"),
            ssm=session.client("ssm"),
            rds=session.client("rds"),
        )
