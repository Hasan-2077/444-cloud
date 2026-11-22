"""Shared pytest fixtures for the final Weather Advisor project."""

from pathlib import Path

import pytest

from stack.clients import AwsClients
from stack.config import Settings
from stack.outputs import StackOutputs


ROOT = Path(__file__).resolve().parent.parent


FAKE_VALUES = {
    # AWS / EC2
    "AWS_REGION": "us-east-2",
    "AMI_ID": "ami-12345678",
    "INSTANCE_TYPE": "t3.micro",
    "KEY_NAME": "test-key",
    "ALLOWED_CIDR": "203.0.113.10/32",

    # Shared application
    "APP_PORT": "3000",
    "APP_SECURITY_GROUP_ID": "sg-placeholder",

    # Network
    "AZ_A": "us-east-2a",
    "AZ_B": "us-east-2b",

    # Weather tier
    "WEATHER_ROLE_NAME": "t-final-weather-role",
    "WEATHER_PROFILE_NAME": "t-final-weather-profile",
    "WEATHER_LT_NAME": "t-final-weather-lt",
    "WEATHER_TG_NAME": "t-final-weather-tg",
    "WEATHER_ASG_NAME": "t-final-weather-asg",
    "WEATHER_LISTENER_PORT": "8080",

    # Advisor tier
    "ADVISOR_ROLE_NAME": "t-final-advisor-role",
    "ADVISOR_PROFILE_NAME": "t-final-advisor-profile",
    "ADVISOR_LT_NAME": "t-final-advisor-lt",
    "ADVISOR_TG_NAME": "t-final-advisor-tg",
    "ADVISOR_ASG_NAME": "t-final-advisor-asg",
    "ADVISOR_LISTENER_PORT": "8081",

    # Load balancer
    "ALB_NAME": "t-final-weather-alb",
    "ALB_SG_NAME": "t-final-weather-alb-sg",

    # DynamoDB
    "DYNAMODB_TABLE_NAME": "t-final-weather-advisor",
    "DYNAMODB_TTL_ATTRIBUTE": "expiresAt",
    "DYNAMODB_RETRY_MS": "30000",

    # Gemini
    "GEMINI_PARAM_NAME": "/test/final/gemini-api-key",
    "GEMINI_MODEL": "gemini-3.1-flash-lite",
    "KEY_CACHE_SECONDS": "60",
    "GEMINI_DAILY_CAP": "20",

    # Email abuse control
    "EMAIL_LIMIT": "3",
    "EMAIL_LIMIT_WINDOW_SECONDS": "3600",

    # SES
    "SES_FROM_EMAIL": "sender@example.com",
    "SES_REGION": "us-east-2",

    # NWS contact
    "CONTACT_EMAIL": "student@example.com",
}


@pytest.fixture
def fake_settings(tmp_path):
    """Build final-project settings with tiny fake app folders."""

    weather = tmp_path / "weather-app"
    advisor = tmp_path / "advisor-app"

    weather.mkdir()
    advisor.mkdir()

    for folder, name in (
        (weather, "weather-app"),
        (advisor, "advisor-app"),
    ):
        (folder / "app.js").write_text(
            f"console.log('{name}');\n"
        )

        (folder / "package.json").write_text(
            (
                '{\n'
                f'  "name": "{name}",\n'
                '  "version": "1.0.0"\n'
                '}\n'
            )
        )

        lib_dir = folder / "lib"
        lib_dir.mkdir()

        (lib_dir / "example.js").write_text(
            "module.exports = {};\n"
        )

    shared_lib = (
        tmp_path
        / "shared"
        / "lib"
    )

    shared_lib.mkdir(
        parents=True
    )

    (
        shared_lib
        / "storage-model.js"
    ).write_text(
        "module.exports = {};\n"
    )

    return Settings.from_values(
        FAKE_VALUES,
        base_dir=tmp_path,
    )


@pytest.fixture(scope="session")
def settings():
    """Settings for real deployed-stack tests."""

    return Settings.from_file(
        ROOT / ".env"
    )


@pytest.fixture(scope="session")
def aws(settings):
    """Real AWS clients for integration tests."""

    return AwsClients.create(
        settings.region
    )


@pytest.fixture(scope="session")
def outputs():
    """Load deployed stack outputs when available."""

    try:
        return StackOutputs.load(
            ROOT
        )

    except FileNotFoundError:
        pytest.skip(
            "stack_outputs.json not found. "
            "Deploy the stack first."
        )
