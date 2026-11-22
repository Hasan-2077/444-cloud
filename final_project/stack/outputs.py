"""Output files for the Assignment 6 Weather Advisor stack."""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from pathlib import Path


@dataclass
class StackOutputs:
    """Important non-secret resources created by the stack."""

    vpc_id: str
    subnet_a: str
    subnet_b: str

    alb_security_group_id: str
    alb_arn: str
    alb_dns_name: str

    weather_tg_arn: str
    advisor_tg_arn: str

    def tg_arn(
        self,
        tier_name: str,
    ) -> str:
        """Return the target-group ARN for one tier."""

        return {
            "weather": self.weather_tg_arn,
            "advisor": self.advisor_tg_arn,
        }[tier_name]

    def save(
        self,
        directory: str | Path = ".",
    ) -> None:
        """Write stack_outputs.json and stack_outputs.env."""

        directory = Path(directory)

        data = asdict(self)

        (
            directory / "stack_outputs.json"
        ).write_text(
            json.dumps(
                data,
                indent=2,
            )
            + "\n"
        )

        env_values = {
            "VPC_ID":
                self.vpc_id,

            "SUBNET_A":
                self.subnet_a,

            "SUBNET_B":
                self.subnet_b,

            "ALB_SECURITY_GROUP_ID":
                self.alb_security_group_id,

            "ALB_ARN":
                self.alb_arn,

            "ALB_DNS_NAME":
                self.alb_dns_name,

            "WEATHER_TG_ARN":
                self.weather_tg_arn,

            "ADVISOR_TG_ARN":
                self.advisor_tg_arn,
        }

        env_lines = [
            f"{key}={value}"
            for key, value
            in env_values.items()
        ]

        (
            directory / "stack_outputs.env"
        ).write_text(
            "\n".join(env_lines)
            + "\n"
        )

    @classmethod
    def load(
        cls,
        directory: str | Path = ".",
    ) -> "StackOutputs":
        """Load outputs from stack_outputs.json."""

        directory = Path(directory)

        return cls(
            **json.loads(
                (
                    directory
                    / "stack_outputs.json"
                ).read_text()
            )
        )

    @staticmethod
    def remove(
        directory: str | Path = ".",
    ) -> None:
        """Remove generated stack output files."""

        directory = Path(directory)

        for name in (
            "stack_outputs.json",
            "stack_outputs.env",
        ):
            (
                directory / name
            ).unlink(
                missing_ok=True
            )
