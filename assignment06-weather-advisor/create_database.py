"""Create the Assignment 6 PostgreSQL database stack."""

from __future__ import annotations

import boto3

from stack.config import Settings
from stack.database import create_database


def main() -> None:
    """Create the database resources."""

    settings = Settings.from_file(".env")

    session = boto3.Session(
        region_name=settings.region
    )

    ec2 = session.client("ec2")
    rds = session.client("rds")
    ssm = session.client("ssm")

    create_database(
        ec2=ec2,
        rds=rds,
        ssm=ssm,
        settings=settings,
        output_path="db_outputs.env",
    )


if __name__ == "__main__":
    main()
