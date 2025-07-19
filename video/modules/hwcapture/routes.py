# /video/modules/hwcapture/routes.py
"""
FastAPI endpoints:

GET  /hwcapture/devices             – JSON list of /dev/video? capabilities
GET  /hwcapture/stream              – MJPEG preview  (img tag friendly)
POST /hwcapture/record              – start HW-encoded recording
DEL  /hwcapture/record/{job_id}     – stop recording
"""

from __future__ import annotations
import io, json, logging, subprocess, uuid, os, shlex
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Query, Response, HTTPException
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from .hwcapture import list_video_devices, HWAccelRecorder

router = APIRouter(prefix="/hwcapture", tags=["hwcapture"])
_log   = logging.getLogger("video.hwcapture")

# ← dynamically resolved from DATA_DIR / "hwcapture" / "hls"
PUBLIC_STREAM_DIR = get_module_path("hwcapture", "hls")


# ────────────────────────────────────────────────────────────
# Utils
# ────────────────────────────────────────────────────────────
def _mjpeg_generator(cmd: list[str]):
    """
    Run ffmpeg → produce multipart/x-mixed-replace MJPEG chunks.
    """
    boundary = b"--frame"
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)

    try:
        while True:
            size_bytes = proc.stdout.read(2)
            if not size_bytes:
                break
            size = int.from_bytes(size_bytes, "big")
            jpg  = proc.stdout.read(size)
            yield boundary + b"\r\n" + b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
    finally:
        proc.terminate()
        proc.wait()

# ────────────────────────────────────────────────────────────
# Endpoints
# ────────────────────────────────────────────────────────────
@router.get("/devices")
async def devices():
    """
    Quick capability dump that the front-end uses to populate <select>.
    """
    return list_video_devices()

@router.get("/stream", include_in_schema=False)
async def stream(
    device : str = Query("/dev/video0", description="V4L2 device"),
    width  : int = Query(640),
    height : int = Query(360),
    fps    : int = Query(20)
):
    """
    MJPEG preview – suitable for a plain <img src="…"> tag.
    Uses *software* JPEG encode (ffmpeg mjpeg), but tiny frames → low CPU.
    """
    cmd = shlex.split(
        f"ffmpeg -loglevel error -f v4l2 -video_size {width}x{height} "
        f"-framerate {fps} -i {device} "
        "-vf format=yuv420p "
        "-f mjpeg -q:v 7 -"
    )
    gen = _mjpeg_generator(cmd)
    return StreamingResponse(gen, media_type="multipart/x-mixed-replace; boundary=frame")

# --- very light-weight "jobs" dict ------------------------------------------
_jobs: dict[str, HWAccelRecorder] = {}

@router.post("/record")
async def start_record(
    device : str  = Query("/dev/video0"),
    fname  : str  = Query("capture.mp4"),
    codec  : str  = Query("h264")
):
    """
    Kick off a background hw-encoded recording job.
    Returns a simple job_id you can DELETE later.
    """
    job_id = str(uuid.uuid4())
    rec = HWAccelRecorder(device=device, output_file=fname)
    await run_in_threadpool(rec.start_recording_hw, codec)
    _jobs[job_id] = rec
    _log.info("▶ recording %s → %s (%s)", device, fname, job_id)
    return {"job": job_id, "file": fname}

@router.delete("/record/{job_id}")
async def stop_record(job_id: str):
    rec = _jobs.pop(job_id, None)
    if not rec:
        raise HTTPException(404, "job not found")
    await run_in_threadpool(rec.stop_recording)
    _log.info("⏹ stopped %s", job_id)
    return {"stopped": job_id}
    
@router.post("/witness_record")
async def witness_record(duration: int = 60):
    """
    Fire-and-forget job; returns filenames when done.
    """
    job_id = str(uuid.uuid4())
    def _worker():
        record_with_witness(duration=duration)
        _jobs[job_id] = {"status":"done",
                         "raw":"main_raw.mp4",
                         "stabilised":"main_stab.mp4"}
    threading.Thread(target=_worker, daemon=True).start()
    return {"job": job_id, "status":"started"}