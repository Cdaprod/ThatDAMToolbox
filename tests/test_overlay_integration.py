"""Overlay network integration test.

This test spins up the overlay stack via docker compose, issues a token
from the API gateway, registers with the overlay-hub, and sends a
heartbeat. Containers are cleaned up afterwards.

Example:
    pytest -q tests/test_overlay_integration.py
"""

import shutil
import subprocess
import time

import pytest
import requests

COMPOSE_SERVICES = ["overlay-hub", "api-gateway", "capture-daemon", "camera-proxy"]


def run(cmd: list[str]) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, check=False, capture_output=True, text=True)


def start_stack() -> None:
    cmd = ["docker", "compose", "up", "-d"] + COMPOSE_SERVICES
    run(cmd)
    time.sleep(5)


def stop_stack() -> None:
    run(["docker", "compose", "rm", "-sf"] + COMPOSE_SERVICES)


def test_overlay_flow():
    if not shutil.which("docker"):
        pytest.skip("docker not installed")
    try:
        start_stack()
        resp = requests.post("http://localhost:8080/agents/issue", json={"agent_id": "test"})
        token = resp.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}
        r1 = requests.post("http://localhost:8090/v1/register", headers=headers)
        r2 = requests.post("http://localhost:8090/v1/heartbeat", headers=headers)
        assert r1.status_code == 200 and r2.status_code == 200
    finally:
        stop_stack()
