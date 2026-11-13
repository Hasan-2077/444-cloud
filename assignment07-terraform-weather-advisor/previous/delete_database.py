"""Delete the Assignment 6 PostgreSQL database stack."""

from __future__ import annotations

import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from stack.config import Settings
from stack.database import (
    find_default_vpc,
    find_security_group,
    subnet_group_exists,
    database_exists,
    parameter_exists,
)


def delete_database_instance(rds, instance_id: str) -> None:
    """Delete the RDS instance with no final snapshot."""

    if not database_exists(rds, instance_id):
        print(
            "Database instance not found, skipping:",
            instance_id,
        )
        return

    print(
        "Deleting database instance:",
        instance_id,
    )

    rds.delete_db_instance(
        DBInstanceIdentifier=instance_id,
        SkipFinalSnapshot=True,
        DeleteAutomatedBackups=True,
    )

    print(
        "Waiting for database instance to be deleted..."
    )

    waiter = rds.get_waiter(
        "db_instance_deleted"
    )

    waiter.wait(
        DBInstanceIdentifier=instance_id,
        WaiterConfig={
            "Delay": 30,
            "MaxAttempts": 60,
        },
    )

    print(
        "Database instance deleted."
    )


def delete_db_subnet_group(
    rds,
    subnet_group_name: str,
) -> None:
    """Delete the DB subnet group if it exists."""

    if not subnet_group_exists(
        rds,
        subnet_group_name,
    ):
        print(
            "DB subnet group not found, skipping:",
            subnet_group_name,
        )
        return

    try:
        rds.delete_db_subnet_group(
            DBSubnetGroupName=subnet_group_name
        )

        print(
            "Deleted DB subnet group:",
            subnet_group_name,
        )

    except ClientError as err:
        print(
            "Could not delete DB subnet group:",
            err,
        )
        raise


def delete_database_security_group(
    ec2,
    settings: Settings,
) -> None:
    """Delete the database security group if it exists."""

    vpc_id = find_default_vpc(ec2)

    group_id = find_security_group(
        ec2,
        settings.database.security_group_name,
        vpc_id,
    )

    if not group_id:
        print(
            "Database security group not found, skipping."
        )
        return

    for attempt in range(1, 11):
        try:
            ec2.delete_security_group(
                GroupId=group_id
            )

            print(
                "Deleted database security group:",
                group_id,
            )

            return

        except ClientError as err:
            code = (
                err.response
                .get("Error", {})
                .get("Code")
            )

            if code == "DependencyViolation":
                print(
                    f"Security group still in use "
                    f"(attempt {attempt}/10), waiting..."
                )

                time.sleep(15)
                continue

            if code == "InvalidGroup.NotFound":
                print(
                    "Database security group already gone."
                )
                return

            raise

    raise RuntimeError(
        "Database security group could not be deleted "
        "after repeated attempts."
    )


def delete_database_password(
    ssm,
    parameter_name: str,
) -> None:
    """Delete the database password parameter if it exists."""

    if not parameter_exists(
        ssm,
        parameter_name,
    ):
        print(
            "Database password parameter not found, skipping."
        )
        return

    ssm.delete_parameter(
        Name=parameter_name
    )

    print(
        "Deleted database password parameter."
    )


def remove_outputs(
    path: str | Path = "db_outputs.env",
) -> None:
    """Remove the local database outputs file."""

    output_path = Path(path)

    if output_path.exists():
        output_path.unlink()

        print(
            "Removed db_outputs.env."
        )


def main() -> None:
    """Delete all Assignment 6 database resources."""

    settings = Settings.from_file(".env")

    session = boto3.Session(
        region_name=settings.region
    )

    ec2 = session.client("ec2")
    rds = session.client("rds")
    ssm = session.client("ssm")

    print(
        "== Delete PostgreSQL database =="
    )

    delete_database_instance(
        rds,
        settings.database.instance_id,
    )

    print(
        "== Delete DB subnet group =="
    )

    delete_db_subnet_group(
        rds,
        settings.database.subnet_group_name,
    )

    print(
        "== Delete database security group =="
    )

    delete_database_security_group(
        ec2,
        settings,
    )

    print(
        "== Delete database password =="
    )

    delete_database_password(
        ssm,
        settings.database.password_param,
    )

    remove_outputs()

    print(
        "Database cleanup complete."
    )


if __name__ == "__main__":
    main()
