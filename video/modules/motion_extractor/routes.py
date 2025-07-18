#!/usr/bin/env python3
"""
Motion-extractor REST endpoints.

POST /motion/extract              – extract frames from one or many videos
GET  /motion/frames/<run>/<file>  – static access to extracted JPGs
"""
from __future__ import annotations

import logging, shutil, tempfile, uuid
from pathlib import Path
from typing import List

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.staticfiles import StaticFiles

from .motion_extractor import MotionExtractor


# --------------------------------------------------------------------------- #
# config / helpers                                                            #
# --------------------------------------------------------------------------- #
router = APIRouter(prefix="/motion", tags=["motion"])
_log   = logging.getLogger("video.motion")

# Use the same data dir you already mount under /data in your compose:
DATA_DIR = Path(os.getenv("VIDEO_DATA_DIR", "/data"))
PUBLIC_FRAMES_DIR = DATA_DIR / "web_frames"
PUBLIC_FRAMES_DIR.mkdir(parents=True, exist_ok=True)


def _save_upload(upload: UploadFile) -> Path:
    """
    Persist an UploadFile to a temp location and return that file path.
    """
    suffix   = Path(upload.filename or "").suffix or ".mp4"
    tmp_path = Path(tempfile.gettempdir()) / f"vid_{uuid.uuid4()}{suffix}"
    with tmp_path.open("wb") as fp:
        shutil.copyfileobj(upload.file, fp)
    return tmp_path


# --------------------------------------------------------------------------- #
# REST – extract                                                              #
# --------------------------------------------------------------------------- #
@router.post("/extract")
async def extract_motion(files: List[UploadFile] = File(...)):
    """
    Accept 1-N "files" parts (multipart/form-data).
    Returns, for each video, statistics **and** the public URLs of the
    extracted motion frames so the front-end can show them immediately.
    """
    if not files:
        raise HTTPException(status_code=400, detail="no files supplied")

    results = []
    for up in files:
        tmp_path = _save_upload(up)

        # one output folder per input video
        out_dir = PUBLIC_FRAMES_DIR / tmp_path.stem
        out_dir.mkdir(parents=True, exist_ok=True)

        me     = MotionExtractor(tmp_path, output_dir=out_dir)
        saved  = me.extract()

        frame_urls = [
            f"/motion/frames/{out_dir.name}/{p.name}"
            for p in sorted(out_dir.iterdir())
        ]

        results.append({
            "filename"    : up.filename,
            "frames_saved": saved,
            "frames"      : frame_urls,
        })

        _log.info("extracted %d motion frames from %s", saved, up.filename)

    return {"results": results}


# --------------------------------------------------------------------------- #
# Static mount –  /motion/frames/…                                            #
# --------------------------------------------------------------------------- #
router.mount(
    "/frames",
    StaticFiles(directory=PUBLIC_FRAMES_DIR),
    name="frames"
)