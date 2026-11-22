"""Tests for final-project least-privilege IAM policies."""

from stack.policies import (
    advisor_policy,
    dynamodb_table_arn,
    ses_identity_arn,
    ssm_parameter_arn,
    weather_policy,
)


REGION = "us-east-2"
ACCOUNT = "123456789012"
TABLE = "itmo-444-544-final-weather-advisor"
PARAM = "/itmo-444-544/final/gemini-api-key"
SENDER = "weather@example.com"


def statements(policy: dict) -> list[dict]:
    """Return policy statements."""

    return policy["Statement"]


def actions(statement: dict) -> set[str]:
    """Normalize one statement's Action field."""

    value = statement["Action"]

    if isinstance(value, str):
        return {value}

    return set(value)


def test_dynamodb_table_arn():
    assert dynamodb_table_arn(
        REGION,
        ACCOUNT,
        TABLE,
    ) == (
        "arn:aws:dynamodb:"
        "us-east-2:"
        "123456789012:"
        "table/"
        "itmo-444-544-final-weather-advisor"
    )


def test_ssm_parameter_arn():
    assert ssm_parameter_arn(
        REGION,
        ACCOUNT,
        PARAM,
    ) == (
        "arn:aws:ssm:"
        "us-east-2:"
        "123456789012:"
        "parameter/"
        "itmo-444-544/final/gemini-api-key"
    )


def test_ses_sender_arn():
    assert ses_identity_arn(
        REGION,
        ACCOUNT,
        SENDER,
    ) == (
        "arn:aws:ses:"
        "us-east-2:"
        "123456789012:"
        "identity/weather@example.com"
    )


def test_weather_only_gets_required_dynamodb_actions():
    policy = weather_policy(
        REGION,
        ACCOUNT,
        TABLE,
    )

    all_actions = {
        action
        for statement in statements(policy)
        for action in actions(statement)
    }

    assert all_actions == {
        "dynamodb:GetItem",
        "dynamodb:PutItem",
    }


def test_weather_has_no_ssm_access():
    policy = weather_policy(
        REGION,
        ACCOUNT,
        TABLE,
    )

    all_actions = {
        action
        for statement in statements(policy)
        for action in actions(statement)
    }

    assert not any(
        action.startswith("ssm:")
        for action in all_actions
    )


def test_weather_has_no_ses_access():
    policy = weather_policy(
        REGION,
        ACCOUNT,
        TABLE,
    )

    all_actions = {
        action
        for statement in statements(policy)
        for action in actions(statement)
    }

    assert not any(
        action.startswith("ses:")
        for action in all_actions
    )


def test_weather_dynamodb_resource_is_exact_table():
    policy = weather_policy(
        REGION,
        ACCOUNT,
        TABLE,
    )

    statement = statements(policy)[0]

    assert statement["Resource"] == (
        dynamodb_table_arn(
            REGION,
            ACCOUNT,
            TABLE,
        )
    )


def test_advisor_can_use_required_dynamodb_operations():
    policy = advisor_policy(
        REGION,
        ACCOUNT,
        TABLE,
        PARAM,
        SENDER,
    )

    all_actions = {
        action
        for statement in statements(policy)
        for action in actions(statement)
    }

    assert "dynamodb:GetItem" in all_actions
    assert "dynamodb:PutItem" in all_actions
    assert "dynamodb:UpdateItem" in all_actions


def test_advisor_reads_only_configured_gemini_parameter():
    policy = advisor_policy(
        REGION,
        ACCOUNT,
        TABLE,
        PARAM,
        SENDER,
    )

    secret_statements = [
        statement
        for statement in statements(policy)
        if "ssm:GetParameter"
        in actions(statement)
    ]

    assert len(secret_statements) == 1

    assert (
        secret_statements[0]["Resource"]
        ==
        ssm_parameter_arn(
            REGION,
            ACCOUNT,
            PARAM,
        )
    )


def test_advisor_send_email_is_scoped_to_sender():
    policy = advisor_policy(
        REGION,
        ACCOUNT,
        TABLE,
        PARAM,
        SENDER,
    )

    send_statements = [
        statement
        for statement in statements(policy)
        if "ses:SendEmail"
        in actions(statement)
    ]

    assert len(send_statements) == 1

    assert (
        send_statements[0]["Resource"]
        ==
        ses_identity_arn(
            REGION,
            ACCOUNT,
            SENDER,
        )
    )


def test_recipient_verification_actions_are_separate():
    policy = advisor_policy(
        REGION,
        ACCOUNT,
        TABLE,
        PARAM,
        SENDER,
    )

    verification_statements = [
        statement
        for statement in statements(policy)
        if (
            "ses:GetEmailIdentity"
            in actions(statement)
            or
            "ses:CreateEmailIdentity"
            in actions(statement)
        )
    ]

    assert len(
        verification_statements
    ) == 1

    verification_actions = actions(
        verification_statements[0]
    )

    assert verification_actions == {
        "ses:GetEmailIdentity",
        "ses:CreateEmailIdentity",
    }

    assert (
        verification_statements[0][
            "Resource"
        ]
        == "*"
    )


def test_only_recipient_verification_uses_wildcard_resource():
    policy = advisor_policy(
        REGION,
        ACCOUNT,
        TABLE,
        PARAM,
        SENDER,
    )

    wildcard_statements = [
        statement
        for statement in statements(policy)
        if statement["Resource"] == "*"
    ]

    assert len(
        wildcard_statements
    ) == 1

    assert wildcard_statements[0][
        "Sid"
    ] == "RecipientVerificationState"


def test_no_rds_actions_exist():
    policies = [
        weather_policy(
            REGION,
            ACCOUNT,
            TABLE,
        ),
        advisor_policy(
            REGION,
            ACCOUNT,
            TABLE,
            PARAM,
            SENDER,
        ),
    ]

    all_actions = {
        action
        for policy in policies
        for statement in statements(policy)
        for action in actions(statement)
    }

    assert not any(
        action.startswith("rds:")
        for action in all_actions
    )


def test_no_s3_actions_exist():
    policies = [
        weather_policy(
            REGION,
            ACCOUNT,
            TABLE,
        ),
        advisor_policy(
            REGION,
            ACCOUNT,
            TABLE,
            PARAM,
            SENDER,
        ),
    ]

    all_actions = {
        action
        for policy in policies
        for statement in statements(policy)
        for action in actions(statement)
    }

    assert not any(
        action.startswith("s3:")
        for action in all_actions
    )
