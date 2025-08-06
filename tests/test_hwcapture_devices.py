"""Tests for hwcapture device proxy."""
import os

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from video.modules.hwcapture.routes import router


class _DummyClient:
    """Minimal httpx.AsyncClient stub for tests."""

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def get(self, url: str):
        assert url == "http://capture-daemon/devices"
        return httpx.Response(200, json=[{"id": "/dev/video0", "name": "cam"}])


def _app():
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.mark.asyncio
async def test_devices_proxies_to_capture_daemon(monkeypatch):
    """Ensure /hwcapture/devices forwards to capture-daemon."""
    os.environ["CAPTURE_DAEMON_URL"] = "http://capture-daemon"
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _DummyClient())
    client = TestClient(_app())
    resp = client.get("/hwcapture/devices")
    assert resp.status_code == 200
    assert resp.json() == [{"id": "/dev/video0", "name": "cam"}]
