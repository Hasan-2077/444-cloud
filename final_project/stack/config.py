"""Configuration for the final Weather Advisor project."""

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
    "APP_PORT",

    "AZ_A",
    "AZ_B",

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

    "DYNAMODB_TABLE_NAME",
    "DYNAMODB_TTL_ATTRIBUTE",
    "DYNAMODB_RETRY_MS",

    "GEMINI_PARAM_NAME",
    "GEMINI_MODEL",
    "KEY_CACHE_SECONDS",
    "GEMINI_DAILY_CAP",

    "EMAIL_LIMIT",
    "EMAIL_LIMIT_WINDOW_SECONDS",

    "SES_FROM_EMAIL",
    "SES_REGION",

    "CONTACT_EMAIL",
]


class ConfigError(Exception):
    """Raised when required configuration is missing."""


def load_dotenv(
    path: str | Path = ".env",
) -> dict[str, str]:
    """Read KEY=VALUE lines from a .env file."""

    values: dict[str, str] = {}

    for raw in Path(path).read_text().splitlines():
        line = raw.strip()

        if (
            not line
            or line.startswith("#")
            or "=" not in line
        ):
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
        """Return the tier inline-policy name."""

        return f"{self.role_name}-policy"

    @property
    def service_name(self) -> str:
        """Return the systemd service name."""

        return self.name


@dataclass(frozen=True)
class Settings:
    """Complete final-project settings."""

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

    dynamodb_table_name: str
    dynamodb_ttl_attribute: str
    dynamodb_retry_ms: int

    gemini_param_name: str
    gemini_model: str
    key_cache_seconds: int
    gemini_daily_cap: int

    email_limit: int
    email_limit_window_seconds: int

    ses_from_email: str
    ses_region: str

    contact_email: str

    @property
    def tiers(
        self,
    ) -> tuple[Tier, Tier]:
        """Return both application tiers."""

        return (
            self.weather,
            self.advisor,
        )

    def tier(
        self,
        name: str,
    ) -> Tier:
        """Return a tier by name."""

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
        """Build Settings from loaded values."""

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

        def tier(
            prefix: str,
        ) -> Tier:
            name = prefix.lower()

            return Tier(
                name=name,
                role_name=values[
                    f"{prefix}_ROLE_NAME"
                ],
                profile_name=values[
                    f"{prefix}_PROFILE_NAME"
                ],
                lt_name=values[
                    f"{prefix}_LT_NAME"
                ],
                tg_name=values[
                    f"{prefix}_TG_NAME"
                ],
                asg_name=values[
                    f"{prefix}_ASG_NAME"
                ],
                listener_port=int(
                    values[
                        f"{prefix}_LISTENER_PORT"
                    ]
                ),
                app_dir=base / f"{name}-app",
            )

        return cls(
            region=values["AWS_REGION"],
            ami_id=values["AMI_ID"],
            instance_type=values[
                "INSTANCE_TYPE"
            ],
            key_name=values["KEY_NAME"],

            app_security_group_id=values[
                "APP_SECURITY_GROUP_ID"
            ],
            allowed_cidr=values[
                "ALLOWED_CIDR"
            ],
            app_port=int(
                values["APP_PORT"]
            ),

            az_a=values["AZ_A"],
            az_b=values["AZ_B"],

            alb_name=values["ALB_NAME"],
            alb_sg_name=values[
                "ALB_SG_NAME"
            ],

            weather=tier("WEATHER"),
            advisor=tier("ADVISOR"),

            dynamodb_table_name=values[
                "DYNAMODB_TABLE_NAME"
            ],
            dynamodb_ttl_attribute=values[
                "DYNAMODB_TTL_ATTRIBUTE"
            ],
            dynamodb_retry_ms=int(
                values[
                    "DYNAMODB_RETRY_MS"
                ]
            ),

            gemini_param_name=values[
                "GEMINI_PARAM_NAME"
            ],
            gemini_model=values[
                "GEMINI_MODEL"
            ],
            key_cache_seconds=int(
                values[
                    "KEY_CACHE_SECONDS"
                ]
            ),
            gemini_daily_cap=int(
                values[
                    "GEMINI_DAILY_CAP"
                ]
            ),

            email_limit=int(
                values["EMAIL_LIMIT"]
            ),
            email_limit_window_seconds=int(
                values[
                    "EMAIL_LIMIT_WINDOW_SECONDS"
                ]
            ),

            ses_from_email=values[
                "SES_FROM_EMAIL"
            ].strip().lower(),

            ses_region=values[
                "SES_REGION"
            ],

            contact_email=values[
                "CONTACT_EMAIL"
            ].strip(),

        )

    @classmethod
    def from_file(
        cls,
        path: str | Path = ".env",
    ) -> "Settings":
        """Load configuration directly from .env."""

        path = Path(path)

        return cls.from_values(
            load_dotenv(path),
            base_dir=path.resolve().parent,
        )
