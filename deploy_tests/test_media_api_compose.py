"""Smoke test for media-api Compose setup.

Example:
    pytest deploy_tests/test_media_api_compose.py::test_media_api_compose
"""

import subprocess

import pytest


def test_media_api_compose():
    cmd = [
        "docker",
        "compose",
        "-f",
        "docker/compose/docker-compose.media-api.yaml",
        "run",
        "--rm",
        "media-api",
        "ls",
        "/data",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True)
    except FileNotFoundError:
        pytest.skip("docker not installed")
    assert proc.returncode == 0, proc.stderr
