"""Tests for the Weaviate schema definition.

Run with:
    PYTHONPATH=. pytest docker/weaviate/test_schema.py
"""

import json
from pathlib import Path


def test_schema_json_parses_and_contains_classes():
    schema_path = Path(__file__).with_name("schema.json")
    with open(schema_path) as f:
        schema = json.load(f)

    classes = {cls["class"] for cls in schema.get("classes", [])}
    assert {"VideoAsset", "CaptureDevice", "CaptureEvent"} <= classes

