#!/usr/bin/env python3
"""Bootstrap a Weaviate schema from a JSON definition.

Example:
    WEAVIATE_URL=http://weaviate:8080 \
    WEAVIATE_SCHEMA=schema.json \
    python bootstrap-schema.py
"""

import json
import os
import sys
import time
from typing import Any

import requests

WEAVIATE_URL = os.environ.get("WEAVIATE_URL", "http://weaviate:8080")
SCHEMA_FILE = os.environ.get("WEAVIATE_SCHEMA", "schema.json")


def wait_for_weaviate(url: str) -> bool:
    """Poll the readiness endpoint until Weaviate is up."""
    for _ in range(30):
        try:
            res = requests.get(f"{url}/v1/.well-known/ready", timeout=2)
            if res.ok:
                return True
        except requests.RequestException:
            pass
        time.sleep(2)
    return False


def main() -> int:
    if not wait_for_weaviate(WEAVIATE_URL):
        print("Weaviate not ready after 60s", file=sys.stderr)
        return 1

    try:
        with open(SCHEMA_FILE) as f:
            schema: dict[str, Any] = json.load(f)
    except (OSError, json.JSONDecodeError) as exc:
        print(f"Failed to load schema: {exc}", file=sys.stderr)
        return 1

    for cls in schema.get("classes", []):
        url = f"{WEAVIATE_URL}/v1/schema"
        resp = requests.post(url, json=cls)
        if resp.status_code in (200, 201):
            print(f"Created class {cls['class']}")
        elif resp.status_code == 422:
            # Class already exists – treat as success for idempotency
            print(f"Class {cls['class']} already exists")
        else:
            print(
                f"Error creating class {cls['class']}: {resp.text}",
                file=sys.stderr,
            )
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
