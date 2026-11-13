"""Delete the Assignment 6 Weather Advisor application stack."""

from __future__ import annotations

import logging

from stack.clients import AwsClients
from stack.config import Settings
from stack.runner import delete_stack


def main() -> None:
    """Delete the application infrastructure."""

    logging.basicConfig(
        level=logging.INFO,
        format="%(message)s",
    )

    settings = Settings.from_file(".env")

    aws = AwsClients.create(
        settings.region
    )

    delete_stack(
        settings,
        aws,
    )

    print()
    print("Weather Advisor stack cleanup complete.")
    print("RDS database was not deleted.")
    print("Gemini parameter was not deleted.")


if __name__ == "__main__":
    main()
