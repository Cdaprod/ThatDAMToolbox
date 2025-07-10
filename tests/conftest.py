"""
Reusable fixtures for all test modules.
Run tests with:  pytest -q
"""
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
from click.testing import CliRunner
from video.api.main import app
from video.cli.main import cli

# ────── API & CLI helpers ──────
@pytest.fixture(scope="session")
def api_client() -> TestClient:
    return TestClient(app)

@pytest.fixture
def cli_runner() -> CliRunner:
    return CliRunner()

# ────── tiny dummy file ──────
@pytest.fixture
def tiny_mp4(tmp_path: Path) -> Path:
    f = tmp_path / "tiny.mp4";  f.write_bytes(b"\x00");  return f