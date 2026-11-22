"""Create the final Weather Advisor application stack."""

from __future__ import annotations

import logging

from stack.clients import AwsClients
from stack.config import Settings
from stack.runner import create_stack


def main() -> None:
    """Create the final-project application infrastructure."""

    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
    )

    settings = Settings.from_file(
        ".env"
    )

    aws = AwsClients.create(
        settings.region
    )

    outputs = create_stack(
        settings,
        aws,
    )

    print()
    print(
        "Final Weather Advisor stack "
        "created successfully."
    )

    print(
        "Weather service:",
        (
            f"http://{outputs.alb_dns_name}:"
            f"{settings.weather.listener_port}"
            "/weather"
        ),
    )

    print(
        "Advisor:",
        (
            f"http://{outputs.alb_dns_name}:"
            f"{settings.advisor.listener_port}/"
        ),
    )


if __name__ == "__main__":
    main()
