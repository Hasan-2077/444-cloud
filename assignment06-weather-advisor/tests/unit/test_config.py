def test_tiers_are_built_from_prefixed_keys(fake_settings):
    weather, advisor = fake_settings.tiers

    assert (
        weather.name,
        weather.listener_port,
        weather.asg_name,
    ) == (
        "weather",
        8080,
        "t-weather-asg",
    )

    assert (
        advisor.name,
        advisor.listener_port,
        advisor.asg_name,
    ) == (
        "advisor",
        8081,
        "t-advisor-asg",
    )


def test_ports_are_integers(fake_settings):
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

    assert isinstance(
        fake_settings.database.port,
        int,
    )


def test_database_settings_are_loaded(fake_settings):
    db = fake_settings.database

    assert db.instance_id == "t-weather-db"
    assert db.name == "weather"
    assert db.user == "weatherapp"
    assert db.security_group_name == "t-weather-db-sg"
    assert db.subnet_group_name == "t-weather-db-subnets"
    assert db.password_param == "/test/weather/db-password"
    assert db.instance_class == "db.t4g.micro"
    assert db.allocated_storage == 20
    assert db.storage_type == "gp2"
    assert db.port == 5432


def test_cache_settings_are_integers(fake_settings):
    assert isinstance(
        fake_settings.cache_seconds,
        int,
    )

    assert isinstance(
        fake_settings.key_cache_seconds,
        int,
    )

    assert fake_settings.cache_seconds == 60
    assert fake_settings.key_cache_seconds == 60


def test_gemini_settings_are_loaded(fake_settings):
    assert (
        fake_settings.gemini_param_name
        == "/test/weather/gemini-api-key"
    )

    assert (
        fake_settings.gemini_model
        == "gemini-3.6-flash"
    )


def test_required_security_and_network_values(fake_settings):
    assert fake_settings.allowed_cidr == "203.0.113.10/32"
    assert fake_settings.app_security_group_id == "sg-placeholder"
    assert fake_settings.az_a == "us-east-2a"
    assert fake_settings.az_b == "us-east-2b"
    assert fake_settings.app_port == 3000
