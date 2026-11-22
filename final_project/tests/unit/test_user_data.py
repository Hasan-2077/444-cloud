"""Tests for Python-only EC2 user-data generation."""

import base64
import io
import tarfile

from stack.compute import (
    build_runtime_archive,
    build_user_data,
    environment_for,
    launch_template_data,
)


def archive_files(
    encoded_archive,
):
    """Return files contained in a base64 tar.gz archive."""

    payload = base64.b64decode(
        encoded_archive
    )

    files = {}

    with tarfile.open(
        fileobj=io.BytesIO(payload),
        mode="r:gz",
    ) as archive:
        for member in archive.getmembers():
            if not member.isfile():
                continue

            handle = archive.extractfile(
                member
            )

            files[member.name] = (
                handle.read().decode()
            )

    return files


def test_runtime_archive_contains_app_files(
    fake_settings,
):
    for tier in fake_settings.tiers:
        encoded = build_runtime_archive(
            fake_settings,
            tier,
        )

        files = archive_files(
            encoded
        )

        app_name = tier.app_dir.name

        assert (
            f"{app_name}/app.js"
            in files
        )

        assert (
            f"{app_name}/package.json"
            in files
        )

        assert (
            f"{app_name}/lib/example.js"
            in files
        )

        assert (
            "shared/lib/storage-model.js"
            in files
        )


def test_weather_environment_is_correct(
    fake_settings,
):
    environment = environment_for(
        fake_settings,
        fake_settings.weather,
    )

    assert (
        environment["PORT"]
        == "3000"
    )

    assert (
        environment["AWS_REGION"]
        == "us-east-2"
    )

    assert (
        environment["WEATHER_TABLE"]
        == "t-final-weather-advisor"
    )

    assert (
        environment["DYNAMODB_RETRY_MS"]
        == "30000"
    )

    assert (
        "student@example.com"
        in environment["NWS_USER_AGENT"]
    )

    assert (
        "REPORT_TABLE"
        not in environment
    )

    assert (
        "GEMINI_KEY_PARAM"
        not in environment
    )


def test_advisor_environment_is_correct(
    fake_settings,
):
    environment = environment_for(
        fake_settings,
        fake_settings.advisor,
        alb_dns_name=
            "test-alb.example.amazonaws.com",
    )

    assert (
        environment["WEATHER_URL"]
        ==
        "http://test-alb.example.amazonaws.com:8080"
    )

    assert (
        environment["REPORT_TABLE"]
        == "t-final-weather-advisor"
    )

    assert (
        environment["GEMINI_KEY_PARAM"]
        == "/test/final/gemini-api-key"
    )

    assert (
        environment["GEMINI_MODEL"]
        == "gemini-3.1-flash-lite"
    )

    assert (
        environment["KEY_CACHE_SECONDS"]
        == "60"
    )

    assert (
        environment["GEMINI_DAILY_CAP"]
        == "20"
    )

    assert (
        environment["EMAIL_LIMIT"]
        == "3"
    )

    assert (
        environment[
            "EMAIL_LIMIT_WINDOW_SECONDS"
        ]
        == "3600"
    )

    assert (
        environment["SES_FROM_EMAIL"]
        == "sender@example.com"
    )

    assert (
        environment["SES_REGION"]
        == "us-east-2"
    )


def test_scripts_are_python_only(
    fake_settings,
):
    weather_script = build_user_data(
        fake_settings,
        fake_settings.weather,
    )

    advisor_script = build_user_data(
        fake_settings,
        fake_settings.advisor,
        alb_dns_name=
            "test-alb.example.amazonaws.com",
    )

    assert weather_script.startswith(
        "#!/usr/bin/env python3\n"
    )

    assert advisor_script.startswith(
        "#!/usr/bin/env python3\n"
    )

    assert "#!/bin/bash" not in (
        weather_script
    )

    assert "#!/bin/bash" not in (
        advisor_script
    )


def test_python_bootstrap_manages_systemd(
    fake_settings,
):
    script = build_user_data(
        fake_settings,
        fake_settings.weather,
    )

    assert (
        '"systemctl",'
        in script
    )

    assert (
        '"daemon-reload",'
        in script
    )

    assert (
        '"enable",'
        in script
    )

    assert (
        '"restart",'
        in script
    )

    assert (
        "Restart=always"
        in script
    )


def test_launch_template_user_data_is_base64_script(
    fake_settings,
):
    weather_data = (
        launch_template_data(
            fake_settings,
            fake_settings.weather,
        )
    )

    weather_decoded = (
        base64.b64decode(
            weather_data["UserData"]
        ).decode()
    )

    assert weather_decoded == (
        build_user_data(
            fake_settings,
            fake_settings.weather,
        )
    )

    advisor_data = (
        launch_template_data(
            fake_settings,
            fake_settings.advisor,
            alb_dns_name=
                "test-alb.example.amazonaws.com",
        )
    )

    advisor_decoded = (
        base64.b64decode(
            advisor_data["UserData"]
        ).decode()
    )

    assert advisor_decoded == (
        build_user_data(
            fake_settings,
            fake_settings.advisor,
            alb_dns_name=
                "test-alb.example.amazonaws.com",
        )
    )
