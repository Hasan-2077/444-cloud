"""Delete the final Weather Advisor application stack."""

from __future__ import annotations

import logging

from stack.clients import AwsClients
from stack.config import Settings
from stack.runner import delete_stack


def main() -> None:
    """Delete the final-project application infrastructure."""

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

    delete_stack(
        settings,
        aws,
    )

    print()
    print(
        "Final Weather Advisor stack "
        "cleanup complete."
    )

    print(
        "Gemini SSM parameter was preserved."
    )

    print(
        "SES identities were preserved."
    )


if __name__ == "__main__":
    main()
