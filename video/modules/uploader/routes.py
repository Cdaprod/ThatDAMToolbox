#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# /video/modules/uploader/routes.py
#
# Multipart uploader – streams files to a staging area, then hands them off
# to video.core.ingest for hashing + relocation (non-blocking).
# ---------------------------------------------------------------------------
from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import List, Optional

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


# ─────────────────────────── endpoint ───────────────────────────────────
@router.post("/", summary="Upload 1–N files (async ingest)")
async def upload_batch(
    request: Request,
    bg: BackgroundTasks,
    files: List[UploadFile] = File(...),
    batch: Optional[str]    = Form(None),
) -> dict:
    """
    Workflow
    ────────
    1. Stream each *UploadFile* into the staging folder.
    2. Queue `ingest_files()` (background) which moves + hashes + DB-registers.
    3. Return immediately with a *queued* JSON payload.
    """
    if not files:
        raise HTTPException(400, "no files sent")

    saved: list[Path] = []
    t0 = time.perf_counter()

    # ── 1) persist uploads --------------------------------------------------
    for f in files:
        tgt = WEB_UPLOADS / f.filename
        try:
            with tgt.open("wb") as out:
                while chunk := await f.read(1 << 20):       # 1 MiB chunks
                    out.write(chunk)
            saved.append(tgt)
            log.debug("⬆ %s → %s (%s bytes)", f.filename, tgt, tgt.stat().st_size)
        finally:
            await f.close()

    # ── 2) schedule ingest --------------------------------------------------
    bg.add_task(ingest_files, saved, batch_name=batch)
    elapsed = (time.perf_counter() - t0) * 1000
    log.info(
        "%s → staged %d file(s) (batch=%s) in %.1f ms – queued ingest",
        _stamp(request), len(saved), batch, elapsed,
    )

    # ── 3) instant API response --------------------------------------------
    return {
        "status": "queued",
        "batch":  batch,
        "files":  [p.name for p in saved],
    }