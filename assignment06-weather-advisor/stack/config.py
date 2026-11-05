"""Configuration for the Assignment 6 Weather Advisor stack."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


REQUIRED_KEYS = [
    "AWS_REGION",
    "AMI_ID",
    "INSTANCE_TYPE",
    "KEY_NAME",
    "APP_SECURITY_GROUP_ID",
    "ALLOWED_CIDR",
    "AZ_A",
    "AZ_B",
    "APP_PORT",

    "WEATHER_ROLE_NAME",
    "WEATHER_PROFILE_NAME",
    "WEATHER_LT_NAME",
    "WEATHER_TG_NAME",
    "WEATHER_ASG_NAME",
    "WEATHER_LISTENER_PORT",

    "ADVISOR_ROLE_NAME",
    "ADVISOR_PROFILE_NAME",
    "ADVISOR_LT_NAME",
    "ADVISOR_TG_NAME",
    "ADVISOR_ASG_NAME",
    "ADVISOR_LISTENER_PORT",

    "ALB_NAME",
    "ALB_SG_NAME",

    "DB_INSTANCE_ID",
    "DB_NAME",
    "DB_USER",
    "DB_SG_NAME",
    "DB_SUBNET_GROUP_NAME",
    "DB_PASSWORD_PARAM",
    "DB_INSTANCE_CLASS",
    "DB_ALLOCATED_STORAGE",
    "DB_STORAGE_TYPE",
    "DB_PORT",

    "CACHE_SECONDS",

    "GEMINI_PARAM_NAME",
    "GEMINI_MODEL",
    "KEY_CACHE_SECONDS",

    "CONTACT_EMAIL",
]


class ConfigError(Exception):
    """Raised when the .env file is missing required configuration."""


def load_dotenv(path: str | Path = ".env") -> dict[str, str]:
    """Read KEY=VALUE lines from a .env file."""

    values: dict[str, str] = {}

    for raw in Path(path).read_text().splitlines():
        line = raw.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, _, value = line.partition("=")

        values[key.strip()] = (
            value.strip()
            .strip('"')
            .strip("'")
        )

    return values


@dataclass(frozen=True)
class Tier:
    """Configuration for one application tier."""

    name: str
    role_name: str
    profile_name: str
    lt_name: str
    tg_name: str
    asg_name: str
    listener_port: int
    app_dir: Path

    @property
    def policy_name(self) -> str:
        return f"{self.role_name}-policy"

    @property
    def service_name(self) -> str:
        return self.name


@dataclass(frozen=True)
class Database:
    """Configuration for the PostgreSQL database."""

    instance_id: str
    name: str
    user: str
    security_group_name: str
    subnet_group_name: str
    password_param: str
    instance_class: str
    allocated_storage: int
    storage_type: str
    port: int


@dataclass(frozen=True)
class Settings:
    """Complete Assignment 6 settings."""

    region: str
    ami_id: str
    instance_type: str
    key_name: str

    app_security_group_id: str
    allowed_cidr: str
    app_port: int

    az_a: str
    az_b: str

    alb_name: str
    alb_sg_name: str

    weather: Tier
    advisor: Tier

    database: Database

    cache_seconds: int

    gemini_param_name: str
    gemini_model: str
    key_cache_seconds: int

    contact_email: str

    @property
    def tiers(self) -> tuple[Tier, Tier]:
        """Return both application tiers."""

        return (
            self.weather,
            self.advisor,
        )

    def tier(self, name: str) -> Tier:
        """Return one application tier by name."""

        return {
            "weather": self.weather,
            "advisor": self.advisor,
        }[name]

    @classmethod
    def from_values(
        cls,
        values: dict[str, str],
        base_dir: str | Path = ".",
    ) -> "Settings":
        """Build Settings from already-loaded values."""

        missing = [
            key
            for key in REQUIRED_KEYS
            if not values.get(key)
        ]

        if missing:
            raise ConfigError(
                "Missing keys in .env: "
                + ", ".join(missing)
            )

        base = Path(base_dir)

        def tier(prefix: str) -> Tier:
            name = prefix.lower()

            return Tier(
                name=name,
                role_name=values[f"{prefix}_ROLE_NAME"],
                profile_name=values[f"{prefix}_PROFILE_NAME"],
                lt_name=values[f"{prefix}_LT_NAME"],
                tg_name=values[f"{prefix}_TG_NAME"],
                asg_name=values[f"{prefix}_ASG_NAME"],
                listener_port=int(
                    values[f"{prefix}_LISTENER_PORT"]
                ),
                app_dir=base / f"{name}-app",
            )

        database = Database(
            instance_id=values["DB_INSTANCE_ID"],
            name=values["DB_NAME"],
            user=values["DB_USER"],
            security_group_name=values["DB_SG_NAME"],
            subnet_group_name=values["DB_SUBNET_GROUP_NAME"],
            password_param=values["DB_PASSWORD_PARAM"],
            instance_class=values["DB_INSTANCE_CLASS"],
            allocated_storage=int(
                values["DB_ALLOCATED_STORAGE"]
            ),
            storage_type=values["DB_STORAGE_TYPE"],
            port=int(values["DB_PORT"]),
        )

        return cls(
            region=values["AWS_REGION"],
            ami_id=values["AMI_ID"],
            instance_type=values["INSTANCE_TYPE"],
            key_name=values["KEY_NAME"],

            app_security_group_id=
                values["APP_SECURITY_GROUP_ID"],

            allowed_cidr=
                values["ALLOWED_CIDR"],

            app_port=int(values["APP_PORT"]),

            az_a=values["AZ_A"],
            az_b=values["AZ_B"],

            alb_name=values["ALB_NAME"],
            alb_sg_name=values["ALB_SG_NAME"],

            weather=tier("WEATHER"),
            advisor=tier("ADVISOR"),

            database=database,

            cache_seconds=int(
                values["CACHE_SECONDS"]
            ),

            gemini_param_name=
                values["GEMINI_PARAM_NAME"],

            gemini_model=
                values["GEMINI_MODEL"],

            key_cache_seconds=int(
                values["KEY_CACHE_SECONDS"]
            ),

            contact_email=
                values["CONTACT_EMAIL"],
        )

    @classmethod
    def from_file(
        cls,
        path: str | Path = ".env",
    ) -> "Settings":
        """Load configuration directly from a .env file."""

        path = Path(path)

        return cls.from_values(
            load_dotenv(path),
            base_dir=path.resolve().parent,
        )
