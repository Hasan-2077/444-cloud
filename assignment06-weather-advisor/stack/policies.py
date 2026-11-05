"""IAM policies for the Assignment 6 application tiers."""

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


def ssm_parameter_arn(
    region: str,
    account_id: str,
    parameter_name: str,
) -> str:
    """Build the ARN for one SSM parameter."""

    return (
        f"arn:aws:ssm:{region}:{account_id}:"
        f"parameter{parameter_name}"
    )


def secret_read_policy(
    parameter_arn: str,
) -> dict:
    """Allow reading exactly one SSM parameter."""

    return {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "ssm:GetParameter",
                ],
                "Resource": parameter_arn,
            }
        ],
    }


def weather_policy(
    region: str,
    account_id: str,
    db_password_parameter: str,
) -> dict:
    """Weather may read only the database password."""

    arn = ssm_parameter_arn(
        region,
        account_id,
        db_password_parameter,
    )

    return secret_read_policy(arn)


def advisor_policy(
    region: str,
    account_id: str,
    gemini_parameter: str,
) -> dict:
    """Advisor may read only the Gemini API key."""

    arn = ssm_parameter_arn(
        region,
        account_id,
        gemini_parameter,
    )

    return secret_read_policy(arn)


def policy_for(
    tier_name: str,
    region: str,
    account_id: str,
    db_password_parameter: str,
    gemini_parameter: str,
) -> dict:
    """Return the correct least-privilege policy for a tier."""

    if tier_name == "weather":
        return weather_policy(
            region,
            account_id,
            db_password_parameter,
        )

    if tier_name == "advisor":
        return advisor_policy(
            region,
            account_id,
            gemini_parameter,
        )

    raise ValueError(
        f"Unknown tier: {tier_name}"
    )
