"""Helpers for AWS SSM Parameter Store secrets."""

from __future__ import annotations

from getpass import getpass

import boto3


def parameter_exists(ssm, name: str) -> bool:
    """Return True if an SSM parameter exists."""
    try:
        ssm.get_parameter(Name=name)
        return True
    except ssm.exceptions.ParameterNotFound:
        return False


def store_secure_parameter(ssm, name: str, value: str) -> None:
    """Create or replace an encrypted SecureString parameter."""
    ssm.put_parameter(
        Name=name,
        Type="SecureString",
        Value=value,
        Overwrite=True,
    )


def prompt_and_store_gemini_key(region: str, parameter_name: str) -> None:
    """Read the Gemini key silently and store it in SSM."""
    ssm = boto3.client("ssm", region_name=region)

    key = getpass("Gemini API key: ").strip()

    if not key:
        raise ValueError("Gemini API key cannot be empty.")

    store_secure_parameter(
        ssm=ssm,
        name=parameter_name,
        value=key,
    )

    print(f"Stored SecureString parameter: {parameter_name}")

