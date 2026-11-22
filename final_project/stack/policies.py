"""Least-privilege IAM policies for the final Weather Advisor project."""

from __future__ import annotations


def trust_policy() -> dict:
    """Allow EC2 instances to assume the role."""

    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "ec2.amazonaws.com"
                },
                "Action": "sts:AssumeRole",
            }
        ],
    }


def dynamodb_table_arn(
    region: str,
    account_id: str,
    table_name: str,
) -> str:
    """Build the ARN for one DynamoDB table."""

    return (
        f"arn:aws:dynamodb:"
        f"{region}:"
        f"{account_id}:"
        f"table/{table_name}"
    )


def ssm_parameter_arn(
    region: str,
    account_id: str,
    parameter_name: str,
) -> str:
    """Build the ARN for one SSM parameter."""

    clean_name = (
        parameter_name
        if parameter_name.startswith("/")
        else "/" + parameter_name
    )

    return (
        f"arn:aws:ssm:"
        f"{region}:"
        f"{account_id}:"
        f"parameter{clean_name}"
    )


def ses_identity_arn(
    region: str,
    account_id: str,
    email_address: str,
) -> str:
    """Build the ARN for one SES sender identity."""

    return (
        f"arn:aws:ses:"
        f"{region}:"
        f"{account_id}:"
        f"identity/{email_address}"
    )


def weather_policy(
    region: str,
    account_id: str,
    table_name: str,
) -> dict:
    """Weather may only read and write cached weather facts."""

    table_arn = dynamodb_table_arn(
        region,
        account_id,
        table_name,
    )

    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "WeatherDynamoDbAccess",
                "Effect": "Allow",
                "Action": [
                    "dynamodb:GetItem",
                    "dynamodb:PutItem",
                ],
                "Resource": table_arn,
            }
        ],
    }


def advisor_policy(
    region: str,
    account_id: str,
    table_name: str,
    gemini_parameter: str,
    ses_from_email: str,
) -> dict:
    """Advisor permissions for cache, Gemini secret, and SES."""

    table_arn = dynamodb_table_arn(
        region,
        account_id,
        table_name,
    )

    gemini_arn = ssm_parameter_arn(
        region,
        account_id,
        gemini_parameter,
    )

    sender_arn = ses_identity_arn(
        region,
        account_id,
        ses_from_email,
    )

    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "AdvisorDynamoDbAccess",
                "Effect": "Allow",
                "Action": [
                    "dynamodb:GetItem",
                    "dynamodb:PutItem",
                    "dynamodb:UpdateItem",
                ],
                "Resource": table_arn,
            },
            {
                "Sid": "ReadGeminiSecret",
                "Effect": "Allow",
                "Action": [
                    "ssm:GetParameter",
                ],
                "Resource": gemini_arn,
            },
            {
                "Sid": "SendFromConfiguredIdentity",
                "Effect": "Allow",
                "Action": [
                    "ses:SendEmail",
                ],
                "Resource": sender_arn,
            },
            {
                "Sid": "RecipientVerificationState",
                "Effect": "Allow",
                "Action": [
                    "ses:GetEmailIdentity",
                    "ses:CreateEmailIdentity",
                ],
                "Resource": "*",
            },
        ],
    }


def policy_for(
    tier_name: str,
    region: str,
    account_id: str,
    table_name: str,
    gemini_parameter: str,
    ses_from_email: str,
) -> dict:
    """Return the least-privilege policy for one tier."""

    if tier_name == "weather":
        return weather_policy(
            region,
            account_id,
            table_name,
        )

    if tier_name == "advisor":
        return advisor_policy(
            region,
            account_id,
            table_name,
            gemini_parameter,
            ses_from_email,
        )

    raise ValueError(
        f"Unknown tier: {tier_name}"
    )
