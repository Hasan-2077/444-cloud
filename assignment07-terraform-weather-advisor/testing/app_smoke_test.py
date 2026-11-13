#!/usr/bin/env python3
"""Call both tiers through the load balancer and check the answers."""

import argparse
import json
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path


def terraform_outputs(folder):
    """Return the stack outputs by running terraform output -json."""
    result = subprocess.run(
        ["terraform", "output", "-json"],
        cwd=folder,
        capture_output=True,
        text=True,
        check=True,
    )
    return {
        name: item["value"]
        for name, item in json.loads(result.stdout).items()
    }


def get(url, timeout=30):
    """Return (status, parsed JSON or text)."""
    try:
        with urllib.request.urlopen(url, timeout=timeout) as resp:
            body = resp.read().decode()
            status = resp.status
    except urllib.error.HTTPError as err:
        body = err.read().decode()
        status = err.code
    except (urllib.error.URLError, TimeoutError) as err:
        return 0, {"error": f"no connection: {err}"}

    try:
        return status, json.loads(body)
    except ValueError:
        return status, body


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--zip",
        default="60616",
        help="zip code for the happy-path checks",
    )
    parser.add_argument("--weather-url")
    parser.add_argument("--advisor-url")
    args = parser.parse_args()

    if args.weather_url and args.advisor_url:
        weather = args.weather_url
        advisor = args.advisor_url
    else:
        lab_folder = Path(__file__).resolve().parent.parent
        outputs = terraform_outputs(lab_folder)
        weather = outputs["weather_url"]
        advisor = outputs["advisor_url"]

    results = []

    def check(name, ok, detail=""):
        results.append(ok)
        print(
            f"{'PASS' if ok else 'FAIL'}   "
            f"{name}   {detail}"
        )

    status, body = get(
        f"{weather}/weather?zip={args.zip}"
    )
    check(
        "weather tier returns a forecast",
        status == 200
        and isinstance(body, dict)
        and "forecast" in body,
        f"status {status}",
    )

    status, body = get(
        f"{weather}/weather?zip={args.zip}"
    )
    cache_value = (
        body.get("cache")
        if isinstance(body, dict)
        else body
    )
    check(
        "a repeat call is answered from DynamoDB (cache hit)",
        status == 200
        and isinstance(body, dict)
        and body.get("cache") == "hit",
        f"cache={cache_value}",
    )

    status, body = get(f"{weather}/history")
    count_value = (
        body.get("count")
        if isinstance(body, dict)
        else "?"
    )
    check(
        "history lists the saved lookups",
        status == 200
        and isinstance(body, dict)
        and body.get("count", 0) >= 1,
        f"status {status}, count={count_value}",
    )

    status, body = get(
        f"{weather}/weather?zip=abc"
    )
    check(
        "weather tier rejects a bad zip with 400",
        status == 400,
        f"status {status}",
    )

    status, body = get(
        f"{weather}/weather?zip=00000"
    )
    check(
        "weather tier returns 404 for an unknown zip",
        status == 404,
        f"status {status}",
    )

    t0 = time.time()
    status, body = get(
        f"{advisor}/advice?zip={args.zip}"
    )
    ok = (
        status == 200
        and isinstance(body, dict)
        and bool(body.get("advice"))
    )

    check(
        "advisor tier returns clothing advice",
        ok,
        f"status {status}, {time.time() - t0:.1f}s",
    )

    if ok:
        print(
            f"      source={body.get('source')} "
            f"model={body.get('model')}"
        )
        print(f"      advice: {body['advice']}")

        check(
            "advice came from Gemini (not the fallback)",
            body.get("source") == "gemini",
            "fallback means the key, quota, or model name needs a look",
        )

    status, body = get(
        f"{advisor}/advice?zip=abc"
    )
    check(
        "advisor tier rejects a bad zip with 400",
        status == 400,
        f"status {status}",
    )

    status, body = get(f"{advisor}/")
    check(
        "advisor home page loads",
        status == 200 and "<form" in str(body),
        f"status {status}",
    )

    print(
        f"\n{sum(results)} of {len(results)} checks passed"
    )

    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    main()
