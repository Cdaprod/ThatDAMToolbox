"""FastAPI endpoints for uploader module.

Example:
    pytest video/modules/uploader/tests/test_routes.py -q
"""

from pathlib import Path
import sys

from fastapi import FastAPI
from fastapi.testclient import TestClient

# Ensure repository root is importable
ROOT = Path(__file__).resolve().parents[4]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from video.modules.uploader.routes import router, UPLOAD_JOBS, WEB_UPLOADS


def test_upload_and_poll(monkeypatch):
    """Ensure POST returns job_id and GET reports progress."""

    def fake_ingest(paths, batch_name=None):
        return None

    monkeypatch.setattr("video.modules.uploader.routes.ingest_files", fake_ingest)

    app = FastAPI()
    app.include_router(router)
    client = TestClient(app)

    files = {"file": ("foo.txt", b"hello", "text/plain")}
    resp = client.post("/api/v1/upload", files=files)
    assert resp.status_code == 200
    job_id = resp.json()["job_id"]

    resp2 = client.get(f"/api/v1/upload/{job_id}")
    assert resp2.status_code == 200
    data = resp2.json()
    assert data["status"] == "done"
    assert data["filename"] == "foo.txt"
    assert data["progress"] == 1.0

    # cleanup
    (WEB_UPLOADS / "foo.txt").unlink(missing_ok=True)
    UPLOAD_JOBS.clear()
