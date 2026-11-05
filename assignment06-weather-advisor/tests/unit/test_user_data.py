import base64
import re

from stack.compute import build_user_data, launch_template_data


def _embedded_files(script):
    encoded = re.findall(
        r"echo '([A-Za-z0-9+/=]+)' \| base64 -d",
        script,
    )

    return [
        base64.b64decode(item).decode()
        for item in encoded
    ]


def test_app_files_are_embedded_and_round_trip(fake_settings):
    for tier, kwargs in (
        (
            fake_settings.weather,
            {
                "db_host": "test-db.example.amazonaws.com",
            },
        ),
        (
            fake_settings.advisor,
            {
                "alb_dns_name": "test-alb.example.amazonaws.com",
            },
        ),
    ):
        script = build_user_data(
            fake_settings,
            tier,
            **kwargs,
        )

        decoded = _embedded_files(script)

        assert decoded[0] == (
            tier.app_dir / "app.js"
        ).read_text()

        assert decoded[1] == (
            tier.app_dir / "package.json"
        ).read_text()


def test_service_gets_the_right_environment(fake_settings):
    weather_script = build_user_data(
        fake_settings,
        fake_settings.weather,
        db_host="test-db.example.amazonaws.com",
    )

    assert (
        "Environment=DB_HOST=test-db.example.amazonaws.com"
        in weather_script
    )
    assert "Environment=DB_NAME=weather" in weather_script
    assert "Environment=DB_USER=weatherapp" in weather_script
    assert (
        "Environment=DB_PASSWORD_PARAM=/test/weather/db-password"
        in weather_script
    )
    assert "Environment=CACHE_SECONDS=60" in weather_script
    assert "Environment=AWS_REGION=us-east-2" in weather_script
    assert "systemctl start weather.service" in weather_script
    assert "Restart=always" in weather_script

    advisor_script = build_user_data(
        fake_settings,
        fake_settings.advisor,
        alb_dns_name="test-alb.example.amazonaws.com",
    )

    assert (
        "Environment=WEATHER_URL="
        "http://test-alb.example.amazonaws.com:8080"
        in advisor_script
    )
    assert (
        "Environment=GEMINI_KEY_PARAM="
        "/test/weather/gemini-api-key"
        in advisor_script
    )
    assert (
        "Environment=GEMINI_MODEL=gemini-3.6-flash"
        in advisor_script
    )
    assert "Environment=KEY_CACHE_SECONDS=60" in advisor_script
    assert "Environment=AWS_REGION=us-east-2" in advisor_script
    assert "systemctl start advisor.service" in advisor_script
    assert "Restart=always" in advisor_script


def test_script_starts_with_a_shebang(fake_settings):
    weather_script = build_user_data(
        fake_settings,
        fake_settings.weather,
        db_host="test-db.example.amazonaws.com",
    )

    advisor_script = build_user_data(
        fake_settings,
        fake_settings.advisor,
        alb_dns_name="test-alb.example.amazonaws.com",
    )

    assert weather_script.startswith("#!/bin/bash\n")
    assert advisor_script.startswith("#!/bin/bash\n")


def test_launch_template_user_data_is_base64_of_the_script(
    fake_settings,
):
    weather_data = launch_template_data(
        fake_settings,
        fake_settings.weather,
        db_host="test-db.example.amazonaws.com",
    )

    weather_decoded = base64.b64decode(
        weather_data["UserData"]
    ).decode()

    assert weather_decoded == build_user_data(
        fake_settings,
        fake_settings.weather,
        db_host="test-db.example.amazonaws.com",
    )

    advisor_data = launch_template_data(
        fake_settings,
        fake_settings.advisor,
        alb_dns_name="test-alb.example.amazonaws.com",
    )

    advisor_decoded = base64.b64decode(
        advisor_data["UserData"]
    ).decode()

    assert advisor_decoded == build_user_data(
        fake_settings,
        fake_settings.advisor,
        alb_dns_name="test-alb.example.amazonaws.com",
    )
