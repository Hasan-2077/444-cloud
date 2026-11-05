from stack.policies import (
    advisor_policy,
    policy_for,
    ssm_parameter_arn,
    trust_policy,
    weather_policy,
)


REGION = "us-east-2"
ACCOUNT_ID = "123456789012"
DB_PARAM = "/test/weather/db-password"
GEMINI_PARAM = "/test/weather/gemini-api-key"


def _allowed_actions(policy):
    actions = []

    for statement in policy["Statement"]:
        if statement["Effect"] == "Allow":
            actions += statement["Action"]

    return actions


def _resources(policy):
    return [
        statement["Resource"]
        for statement in policy["Statement"]
    ]


def test_trust_policy_only_trusts_ec2():
    statement = trust_policy()["Statement"][0]

    assert statement["Principal"] == {
        "Service": "ec2.amazonaws.com"
    }

    assert statement["Action"] == "sts:AssumeRole"


def test_ssm_parameter_arn_is_exact():
    arn = ssm_parameter_arn(
        REGION,
        ACCOUNT_ID,
        DB_PARAM,
    )

    assert arn == (
        "arn:aws:ssm:"
        f"{REGION}:{ACCOUNT_ID}:"
        f"parameter{DB_PARAM}"
    )


def test_weather_can_read_only_database_password():
    policy = weather_policy(
        REGION,
        ACCOUNT_ID,
        DB_PARAM,
    )

    assert _allowed_actions(policy) == [
        "ssm:GetParameter"
    ]

    assert _resources(policy) == [
        (
            "arn:aws:ssm:"
            f"{REGION}:{ACCOUNT_ID}:"
            f"parameter{DB_PARAM}"
        )
    ]


def test_advisor_can_read_only_gemini_key():
    policy = advisor_policy(
        REGION,
        ACCOUNT_ID,
        GEMINI_PARAM,
    )

    assert _allowed_actions(policy) == [
        "ssm:GetParameter"
    ]

    assert _resources(policy) == [
        (
            "arn:aws:ssm:"
            f"{REGION}:{ACCOUNT_ID}:"
            f"parameter{GEMINI_PARAM}"
        )
    ]


def test_policy_for_returns_weather_policy():
    policy = policy_for(
        "weather",
        REGION,
        ACCOUNT_ID,
        DB_PARAM,
        GEMINI_PARAM,
    )

    resource = policy["Statement"][0]["Resource"]

    assert DB_PARAM in resource
    assert GEMINI_PARAM not in resource


def test_policy_for_returns_advisor_policy():
    policy = policy_for(
        "advisor",
        REGION,
        ACCOUNT_ID,
        DB_PARAM,
        GEMINI_PARAM,
    )

    resource = policy["Statement"][0]["Resource"]

    assert GEMINI_PARAM in resource
    assert DB_PARAM not in resource


def test_no_policy_uses_wildcard_resource():
    for tier in (
        "weather",
        "advisor",
    ):
        policy = policy_for(
            tier,
            REGION,
            ACCOUNT_ID,
            DB_PARAM,
            GEMINI_PARAM,
        )

        for statement in policy["Statement"]:
            assert statement["Resource"] != "*"
