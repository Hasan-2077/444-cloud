"""Store the Gemini API key in AWS SSM Parameter Store."""

from pathlib import Path

from stack.secrets import prompt_and_store_gemini_key


def load_dotenv(path: str = ".env") -> dict[str, str]:
    """Read KEY=VALUE settings from .env."""
    values: dict[str, str] = {}

    for raw in Path(path).read_text().splitlines():
        line = raw.strip()

        if not line or line.startswith("#") or "=" not in line:
            continue

        key, value = line.split("=", 1)
        values[key.strip()] = value.strip().strip('"').strip("'")

    return values


def main() -> None:
    env = load_dotenv()

    prompt_and_store_gemini_key(
        region=env["AWS_REGION"],
        parameter_name=env["GEMINI_PARAM_NAME"],
    )


if __name__ == "__main__":
    main()
