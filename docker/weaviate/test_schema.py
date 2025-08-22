"""Tests for the Weaviate schema definition and bootstrap script.

Run with:
    PYTHONPATH=. pytest docker/weaviate/test_schema.py
"""

import io
import json
import runpy
import urllib.error
import urllib.request
from pathlib import Path

import pytest


def test_schema_json_parses_and_contains_classes():
    schema_path = Path(__file__).with_name("schema.json")
    with open(schema_path) as f:
        schema = json.load(f)

    classes = {cls["class"] for cls in schema.get("classes", [])}
    assert {"VideoAsset", "CaptureDevice", "CaptureEvent"} <= classes


def test_bootstrap_script_runs_without_requests(tmp_path, monkeypatch):
    script_path = Path(__file__).with_name("bootstrap-schema.py")
    schema_file = tmp_path / "schema.json"
    schema_file.write_text('{"classes": [{"class": "Foo"}]}')

    monkeypatch.setenv("WEAVIATE_URL", "http://weaviate:8080")
    monkeypatch.setenv("WEAVIATE_SCHEMA", str(schema_file))

    class DummyResponse:
        def __init__(self, status: int, data: bytes):
            self.status = status
            self._data = data

        def read(self) -> bytes:  # pragma: no cover - trivial
            return self._data

        def __enter__(self):  # pragma: no cover - trivial
            return self

        def __exit__(self, exc_type, exc, tb):  # pragma: no cover - trivial
            return False

    def fake_urlopen(req, timeout=2):
        url = req if isinstance(req, str) else req.full_url
        if url.endswith("/v1/.well-known/ready"):
            return DummyResponse(200, b"ok")
        raise urllib.error.HTTPError(url, 422, "exists", {}, io.BytesIO(b""))

    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen)

    with pytest.raises(SystemExit) as exc:
        runpy.run_path(str(script_path), run_name="__main__")
    assert exc.value.code == 0

