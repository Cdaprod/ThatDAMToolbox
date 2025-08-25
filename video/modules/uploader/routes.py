#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# /video/modules/uploader/routes.py
#
# Multipart uploader – streams files to a staging area, then hands them off
# to video.core.ingest for hashing + relocation (non-blocking).
# ---------------------------------------------------------------------------
from __future__ import annotations

import logging
import os
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    UploadFile,
    Request,
)

from video.core.ingest import ingest_files
from video.paths       import get_module_path
from video.config      import WEB_UPLOADS as _FALLBACK_WU

log    = logging.getLogger("video.uploader")
router = APIRouter(prefix="/api/v1/upload", tags=["upload"])

# job_id → {status, filename, progress, error?, timestamp}
UPLOAD_JOBS: Dict[str, Dict[str, Any]] = {}

# seconds to retain completed jobs before cleanup
UPLOAD_TTL = int(os.getenv("UPLOAD_JOB_TTL", "600"))

# ───────────────────────────── staging dir ──────────────────────────────
try:
    WEB_UPLOADS: Path = get_module_path("uploader", "staging")
except Exception:                         # registry not yet populated? fall back
    WEB_UPLOADS = _FALLBACK_WU            # defined in config.py

WEB_UPLOADS.mkdir(parents=True, exist_ok=True)
log.info("Uploader initialised – staging dir: %s", WEB_UPLOADS)

# ─────────────────────────── helpers ────────────────────────────────────
def _stamp(req: Request) -> str:
    """Return concise 'METHOD /path' string for log lines."""
    return f"{req.method} {req.url.path}"


def _cleanup_jobs() -> None:
    """Remove completed jobs older than UPLOAD_TTL."""
    now = time.time()
    stale = [
        jid for jid, job in UPLOAD_JOBS.items()
        if job.get("status") in {"done", "error"}
        and now - job.get("timestamp", now) > UPLOAD_TTL
    ]
    for jid in stale:
        UPLOAD_JOBS.pop(jid, None)


def _ingest(paths: List[Path], job_id: str, batch: Optional[str]) -> None:
    """Run ingest and update job progress."""
    try:
        ingest_files(paths, batch_name=batch)
        UPLOAD_JOBS[job_id].update({
            "status": "done",
            "progress": 1.0,
            "timestamp": time.time(),
        })
    except Exception as exc:  # pragma: no cover - defensive
        log.exception("ingest failed for %s", job_id)
        UPLOAD_JOBS[job_id].update({
            "status": "error",
            "error": str(exc),
            "timestamp": time.time(),
        })


# ─────────────────────────── endpoint ───────────────────────────────────
@router.post("/", summary="Upload file (async ingest)")
async def upload_batch(
    request: Request,
    bg: BackgroundTasks,
    file: UploadFile = File(...),
    batch: Optional[str] = Form(None),
) -> dict:
    """
    Workflow
    ────────
    1. Stream the *UploadFile* into the staging folder.
    2. Queue `_ingest()` which moves + hashes + DB-registers.
    3. Return immediately with a *job_id* JSON payload.
    """
    if not file:
        raise HTTPException(400, "no file sent")

    job_id = uuid.uuid4().hex
    t0 = time.perf_counter()

    # ── 1) persist upload ---------------------------------------------------
    tgt = WEB_UPLOADS / file.filename
    try:
        with tgt.open("wb") as out:
            while chunk := await file.read(1 << 20):  # 1 MiB chunks
                out.write(chunk)
        log.debug("⬆ %s → %s (%s bytes)", file.filename, tgt, tgt.stat().st_size)
    finally:
        await file.close()

    UPLOAD_JOBS[job_id] = {
        "status": "queued",
        "filename": file.filename,
        "progress": 0.0,
        "timestamp": time.time(),
    }

    # ── 2) schedule ingest --------------------------------------------------
    bg.add_task(_ingest, [tgt], job_id, batch)
    elapsed = (time.perf_counter() - t0) * 1000
    log.info(
        "%s → staged %s (batch=%s) in %.1f ms – queued ingest job=%s",
        _stamp(request), file.filename, batch, elapsed, job_id,
    )

    # ── 3) instant API response --------------------------------------------
    _cleanup_jobs()
    return {
        "status": "queued",
        "job_id": job_id,
        "filename": file.filename,
    }


@router.get("/{job_id}", summary="Upload progress")
async def upload_status(job_id: str) -> dict:
    """Return current status for *job_id*."""
    _cleanup_jobs()
    job = UPLOAD_JOBS.get(job_id)
    if not job:
        raise HTTPException(404, "job not found")
    return job
