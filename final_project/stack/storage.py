"""DynamoDB storage for the final Weather Advisor project."""

from __future__ import annotations

import logging
import time

from botocore.exceptions import ClientError

from .clients import AwsClients
from .config import Settings


log = logging.getLogger("stack")


def table_exists(
    aws: AwsClients,
    table_name: str,
) -> bool:
    """Return True if the DynamoDB table already exists."""

    try:
        aws.dynamodb.describe_table(
            TableName=table_name
        )
        return True

    except ClientError as err:
        code = (
            err.response
            .get("Error", {})
            .get("Code")
        )

        if code == "ResourceNotFoundException":
            return False

        raise


def wait_for_table_active(
    aws: AwsClients,
    table_name: str,
    timeout: int = 180,
    poll: int = 5,
    sleep=time.sleep,
) -> None:
    """Wait until DynamoDB reports the table as ACTIVE."""

    waited = 0

    while waited <= timeout:
        response = aws.dynamodb.describe_table(
            TableName=table_name
        )

        status = (
            response["Table"]
            ["TableStatus"]
        )

        if status == "ACTIVE":
            return

        if waited >= timeout:
            raise RuntimeError(
                f"DynamoDB table {table_name} "
                f"did not become ACTIVE "
                f"within {timeout} seconds."
            )

        sleep(poll)
        waited += poll


def ensure_ttl(
    aws: AwsClients,
    settings: Settings,
) -> None:
    """Enable TTL on the configured expiry attribute."""

    response = aws.dynamodb.describe_time_to_live(
        TableName=settings.dynamodb_table_name
    )

    description = response.get(
        "TimeToLiveDescription",
        {},
    )

    status = description.get(
        "TimeToLiveStatus"
    )

    attribute = description.get(
        "AttributeName"
    )

    if (
        status in (
            "ENABLED",
            "ENABLING",
        )
        and attribute
        == settings.dynamodb_ttl_attribute
    ):
        log.info(
            "DynamoDB TTL already configured."
        )
        return

    aws.dynamodb.update_time_to_live(
        TableName=settings.dynamodb_table_name,
        TimeToLiveSpecification={
            "Enabled": True,
            "AttributeName":
                settings.dynamodb_ttl_attribute,
        },
    )

    log.info(
        "Enabled DynamoDB TTL on %s.",
        settings.dynamodb_ttl_attribute,
    )


def ensure_backups_disabled(
    aws: AwsClients,
    settings: Settings,
) -> None:
    """Ensure point-in-time recovery is disabled."""

    response = (
        aws.dynamodb
        .describe_continuous_backups(
            TableName=settings.dynamodb_table_name
        )
    )

    status = (
        response
        ["ContinuousBackupsDescription"]
        ["PointInTimeRecoveryDescription"]
        ["PointInTimeRecoveryStatus"]
    )

    if status == "DISABLED":
        log.info(
            "DynamoDB point-in-time recovery "
            "is already disabled."
        )
        return

    aws.dynamodb.update_continuous_backups(
        TableName=settings.dynamodb_table_name,
        PointInTimeRecoverySpecification={
            "PointInTimeRecoveryEnabled": False
        },
    )

    log.info(
        "Disabled DynamoDB point-in-time recovery."
    )


def ensure_table(
    aws: AwsClients,
    settings: Settings,
) -> None:
    """Create or verify the shared DynamoDB table."""

    table_name = (
        settings.dynamodb_table_name
    )

    if not table_exists(
        aws,
        table_name,
    ):
        aws.dynamodb.create_table(
            TableName=table_name,

            BillingMode="PAY_PER_REQUEST",

            AttributeDefinitions=[
                {
                    "AttributeName": "pk",
                    "AttributeType": "S",
                },
                {
                    "AttributeName": "sk",
                    "AttributeType": "S",
                },
            ],

            KeySchema=[
                {
                    "AttributeName": "pk",
                    "KeyType": "HASH",
                },
                {
                    "AttributeName": "sk",
                    "KeyType": "RANGE",
                },
            ],

            Tags=[
                {
                    "Key": "Project",
                    "Value":
                        "WeatherAdvisorFinal",
                },
            ],
        )

        log.info(
            "Created DynamoDB table %s.",
            table_name,
        )

        wait_for_table_active(
            aws,
            table_name,
        )

    else:
        log.info(
            "DynamoDB table %s already exists.",
            table_name,
        )

    description = (
        aws.dynamodb.describe_table(
            TableName=table_name
        )["Table"]
    )

    billing = (
        description
        .get(
            "BillingModeSummary",
            {},
        )
        .get(
            "BillingMode",
            "PROVISIONED",
        )
    )

    if billing != "PAY_PER_REQUEST":
        raise RuntimeError(
            f"DynamoDB table {table_name} "
            "must use PAY_PER_REQUEST billing."
        )

    key_schema = {
        item["AttributeName"]:
            item["KeyType"]
        for item
        in description["KeySchema"]
    }

    if key_schema != {
        "pk": "HASH",
        "sk": "RANGE",
    }:
        raise RuntimeError(
            f"DynamoDB table {table_name} "
            "does not use the required pk/sk key."
        )

    ensure_ttl(
        aws,
        settings,
    )

    ensure_backups_disabled(
        aws,
        settings,
    )

    log.info(
        "DynamoDB storage is ready."
    )


def delete_table(
    aws: AwsClients,
    settings: Settings,
    timeout: int = 180,
    poll: int = 5,
    sleep=time.sleep,
) -> None:
    """Delete the DynamoDB table if it exists."""

    table_name = (
        settings.dynamodb_table_name
    )

    if not table_exists(
        aws,
        table_name,
    ):
        return

    aws.dynamodb.delete_table(
        TableName=table_name
    )

    log.info(
        "Deleting DynamoDB table %s...",
        table_name,
    )

    waited = 0

    while table_exists(
        aws,
        table_name,
    ):
        if waited >= timeout:
            raise RuntimeError(
                f"DynamoDB table {table_name} "
                f"was still deleting after "
                f"{timeout} seconds."
            )

        sleep(poll)
        waited += poll

    log.info(
        "Deleted DynamoDB table %s.",
        table_name,
    )
