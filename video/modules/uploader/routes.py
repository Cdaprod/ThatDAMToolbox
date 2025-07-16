#!/usr/bin/env python3
# ---------------------------------------------------------------------------
# Uploader routes – multipart file → _INCOMING/web → background ingest
# ---------------------------------------------------------------------------

from __future__ import annotations

import logging
from pathlib import Path
from typing import List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    UploadFile,
)

from video.core.ingest import ingest_files       # 🔸 background worker
from video.config      import WEB_UPLOADS        # Path("/data/_INCOMING/web")

log     = logging.getLogger("video.uploader")
router  = APIRouter(prefix="/api/v1/upload", tags=["upload"])

# ── ensure staging dir exists once at import-time ───────────────────────────
WEB_UPLOADS.mkdir(parents=True, exist_ok=True)
log.info("Uploader ready – staging dir: %s", WEB_UPLOADS)


@router.post("/", summary="Upload 1-N video files as a new batch")
async def upload_batch(
    bg    : BackgroundTasks,
    files : List[UploadFile] = File(...),
    batch : Optional[str]    = Form(None),
) -> dict:
    """
    1. Streams each ‹UploadFile› into *_INCOMING/web/* (non-blocking).
    2. Queues ``ingest_files()`` which:
         • hashes & relocates to /data/media
         • creates / updates batch manifest
    3. Returns immediately with a «queued» response.
    """
    if not files:
        raise HTTPException(status_code=400, detail="no files sent")

    saved: list[Path] = []

    # ── 1) stream uploads to disk ──────────────────────────────────────────
    for f in files:
        tgt = WEB_UPLOADS / f.filename
        try:
            with tgt.open("wb") as out:
                while chunk := await f.read(1 << 20):      # 1 MiB chunks
                    out.write(chunk)
            saved.append(tgt)
            log.info("⬆ %s → %s  (%s bytes)", f.filename, tgt, tgt.stat().st_size)
        finally:
            await f.close()

    # ── 2) kick off ingest worker ──────────────────────────────────────────
    bg.add_task(ingest_files, saved, batch_name=batch)
    log.info("Queued ingest for %d file(s)  – batch=%s", len(saved), batch)

    # ── 3) immediate response ──────────────────────────────────────────────
    return {
        "status": "queued",
        "batch" : batch,
        "files" : [p.name for p in saved],
    }