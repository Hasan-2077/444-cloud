from pathlib import Path

import pytest

from stack.clients import AwsClients
from stack.config import Settings
from stack.outputs import StackOutputs


ROOT = Path(__file__).resolve().parent.parent


FAKE_VALUES = {
    # General AWS settings
    "AWS_REGION": "us-east-2",
    "AMI_ID": "ami-12345678",
    "KEY_NAME": "test-key",
    "INSTANCE_TYPE": "t3.micro",
    "ALLOWED_CIDR": "203.0.113.10/32",

    # Shared application settings
    "APP_PORT": "3000",
    "APP_SECURITY_GROUP_ID": "sg-placeholder",

    # Weather tier
    "WEATHER_ROLE_NAME": "t-weather-role",
    "WEATHER_PROFILE_NAME": "t-weather-profile",
    "WEATHER_LT_NAME": "t-weather-lt",
    "WEATHER_TG_NAME": "t-weather-tg",
    "WEATHER_ASG_NAME": "t-weather-asg",
    "WEATHER_LISTENER_PORT": "8080",

    # Advisor tier
    "ADVISOR_ROLE_NAME": "t-advisor-role",
    "ADVISOR_PROFILE_NAME": "t-advisor-profile",
    "ADVISOR_LT_NAME": "t-advisor-lt",
    "ADVISOR_TG_NAME": "t-advisor-tg",
    "ADVISOR_ASG_NAME": "t-advisor-asg",
    "ADVISOR_LISTENER_PORT": "8081",

    # Load balancer / network
    "ALB_NAME": "t-weather-alb",
    "ALB_SG_NAME": "t-weather-alb-sg",
    "AZ_A": "us-east-2a",
    "AZ_B": "us-east-2b",

    # Database
    "DB_INSTANCE_ID": "t-weather-db",
    "DB_NAME": "weather",
    "DB_USER": "weatherapp",
    "DB_SG_NAME": "t-weather-db-sg",
    "DB_SUBNET_GROUP_NAME": "t-weather-db-subnets",
    "DB_PASSWORD_PARAM": "/test/weather/db-password",
    "DB_INSTANCE_CLASS": "db.t4g.micro",
    "DB_ALLOCATED_STORAGE": "20",
    "DB_STORAGE_TYPE": "gp2",
    "DB_PORT": "5432",

    # Cache
    "CACHE_SECONDS": "60",

    # Gemini / Advisor
    "GEMINI_PARAM_NAME": "/test/weather/gemini-api-key",
    "GEMINI_MODEL": "gemini-3.6-flash",
    "KEY_CACHE_SECONDS": "60",

    # Application identity
    "CONTACT_EMAIL": "student@example.com",

    # Older values kept for compatibility with inherited tests/helpers
    "BUCKET_NAME": "unit-test-bucket-12345",
    "UPLOADER_ROLE_NAME": "t-uploader-role",
    "UPLOADER_PROFILE_NAME": "t-uploader-profile",
    "UPLOADER_LT_NAME": "t-uploader-lt",
    "UPLOADER_TG_NAME": "t-uploader-tg",
    "UPLOADER_ASG_NAME": "t-uploader-asg",
    "UPLOADER_LISTENER_PORT": "8080",
    "VIEWER_ROLE_NAME": "t-viewer-role",
    "VIEWER_PROFILE_NAME": "t-viewer-profile",
    "VIEWER_LT_NAME": "t-viewer-lt",
    "VIEWER_TG_NAME": "t-viewer-tg",
    "VIEWER_ASG_NAME": "t-viewer-asg",
    "VIEWER_LISTENER_PORT": "8081",
    "RECOVERY_SLO_SECONDS": "180",
}


@pytest.fixture
def fake_settings(tmp_path):
    """Settings pointing at tiny fake Weather and Advisor app folders."""

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
            '{"name": "%s"}\n' % name
        )

    return Settings.from_values(
        FAKE_VALUES,
        base_dir=tmp_path,
    )


# Fixtures used by tests that talk to the real deployed stack.
# Integration and chaos tests are excluded from the local unit-test run.


@pytest.fixture(scope="session")
def settings():
    return Settings.from_file(
        ROOT / ".env"
    )


@pytest.fixture(scope="session")
def aws(settings):
    return AwsClients.create(
        settings.region
    )


@pytest.fixture(scope="session")
def outputs():
    try:
        return StackOutputs.load(ROOT)
    except FileNotFoundError:
        pytest.skip(
            "stack_outputs.json not found. "
            "Run python create_stack.py first."
        )

