"""Tests for final-project configuration."""

def test_tiers_are_built_from_prefixed_keys(
    fake_settings,
):
    weather, advisor = fake_settings.tiers

    assert (
        weather.name,
        weather.listener_port,
        weather.asg_name,
    ) == (
        "weather",
        8080,
        "t-final-weather-asg",
    )

    assert (
        advisor.name,
        advisor.listener_port,
        advisor.asg_name,
    ) == (
        "advisor",
        8081,
        "t-final-advisor-asg",
    )


def test_ports_are_integers(
    fake_settings,
):
    assert isinstance(
        fake_settings.weather.listener_port,
        int,
    )

    assert isinstance(
        fake_settings.advisor.listener_port,
        int,
    )

    assert isinstance(
        fake_settings.app_port,
        int,
    )


def test_dynamodb_settings_are_loaded(
    fake_settings,
):
    assert (
        fake_settings.dynamodb_table_name
        == "t-final-weather-advisor"
    )

    assert (
        fake_settings.dynamodb_ttl_attribute
        == "expiresAt"
    )

    assert (
        fake_settings.dynamodb_retry_ms
        == 30000
    )


def test_gemini_settings_are_loaded(
    fake_settings,
):
    assert (
        fake_settings.gemini_param_name
        == "/test/final/gemini-api-key"
    )

    assert (
        fake_settings.gemini_model
        == "gemini-3.1-flash-lite"
    )

    assert (
        fake_settings.key_cache_seconds
        == 60
    )

    assert (
        fake_settings.gemini_daily_cap
        == 20
    )


def test_email_settings_are_loaded(
    fake_settings,
):
    assert (
        fake_settings.email_limit
        == 3
    )

    assert (
        fake_settings
        .email_limit_window_seconds
        == 3600
    )

    assert (
        fake_settings.ses_from_email
        == "sender@example.com"
    )

    assert (
        fake_settings.ses_region
        == "us-east-2"
    )


def test_required_security_and_network_values(
    fake_settings,
):
    assert (
        fake_settings.allowed_cidr
        == "203.0.113.10/32"
    )

    assert (
        fake_settings.app_security_group_id
        == "sg-placeholder"
    )

    assert (
        fake_settings.az_a
        == "us-east-2a"
    )

    assert (
        fake_settings.az_b
        == "us-east-2b"
    )

    assert (
        fake_settings.app_port
        == 3000
    )


def test_old_database_settings_are_absent(
    fake_settings,
):
    assert not hasattr(
        fake_settings,
        "database",
    )

    assert not hasattr(
        fake_settings,
        "cache_seconds",
    )
