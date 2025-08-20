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
        if url == "http://capture-daemon/devices":
            return httpx.Response(200, json=[{"path": "/dev/video0"}])
        if url == "http://camera-proxy/api/devices":
            return httpx.Response(200, json=[{"path": "/dev/video1"}])
        raise AssertionError(f"unexpected url {url}")


def _app():
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.mark.asyncio
async def test_devices_aggregates_sources(monkeypatch):
    os.environ["CAPTURE_DAEMON_URL"] = "http://capture-daemon"
    os.environ["CAMERA_PROXY_URL"] = "http://camera-proxy"
    monkeypatch.setattr(httpx, "AsyncClient", lambda *a, **kw: _DummyClient())
    monkeypatch.setattr("video.modules.hwcapture.routes.list_video_devices", lambda: [{"path": "/dev/video2"}])
    client = TestClient(_app())
    resp = client.get("/hwcapture/devices")
    assert resp.status_code == 200
    assert resp.json() == [
        {"path": "/dev/video0"},
        {"path": "/dev/video1"},
        {"path": "/dev/video2"},
    ]
