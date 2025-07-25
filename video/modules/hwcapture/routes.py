"""
video/modules/hwcapture/routes.py
FastAPI endpoints:

GET  /hwcapture/devices             – JSON list of /dev/video? capabilities
GET  /hwcapture/stream              – MJPEG preview  (img tag friendly)
POST /hwcapture/record              – start HW-encoded recording
DEL  /hwcapture/record/{job_id}     – stop recording
"""

from __future__ import annotations
import io, json, logging, subprocess, uuid, shlex, threading
from typing import Optional

from fastapi import APIRouter, Query, HTTPException
from fastapi.responses import StreamingResponse
from starlette.concurrency import run_in_threadpool

from .hwcapture import list_video_devices, HWAccelRecorder
from .hwcapture import stream_jpeg_frames
from .hwcapture import record as cli_record

from video.config import get_module_path


router = APIRouter(prefix="/hwcapture", tags=["hwcapture"])
_log   = logging.getLogger("video.hwcapture")


# Use module-registered directories!
STREAMS_DIR = get_module_path("hwcapture", "streams")
RECORDS_DIR = get_module_path("hwcapture", "records")


# ──────────── MJPEG generator ─────────────
def _mjpeg_generator(cmd: list[str]):
    boundary = b"--frame"
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    try:
        while True:
            size_bytes = proc.stdout.read(2)
            if not size_bytes:
                break
            size = int.from_bytes(size_bytes, "big")
            jpg = proc.stdout.read(size)
            chunk = (
                boundary
                + b"\r\n"
                + b"Content-Type: image/jpeg\r\n\r\n"
                + jpg
                + b"\r\n"
            )
            yield chunk
            # free references immediately
            del jpg, chunk
    finally:
        proc.terminate()
        proc.wait()
        

# ──────────── Endpoints ─────────────
@router.get("/devices")
async def devices():
    return list_video_devices()


@router.get("/stream", include_in_schema=False)
async def stream(
    device : str = Query("/dev/video0", description="V4L2 device"),
    width  : int = Query(640),
    height : int = Query(360),
    fps    : int = Query(20)
):
    cmd = shlex.split(
        f"ffmpeg -loglevel error -f v4l2 -video_size {width}x{height} "
        f"-framerate {fps} -i {device} "
        "-vf format=yuv420p "
        "-f mjpeg -q:v 7 -"
    )
    gen = _mjpeg_generator(cmd)
    return StreamingResponse(gen, media_type="multipart/x-mixed-replace; boundary=frame")


_jobs: dict[str, HWAccelRecorder] = {}


@router.post("/record")
async def start_record(
    device : str  = Query("/dev/video0"),
    fname  : str  = Query("capture.mp4"),
    codec  : str  = Query("h264")
):
    # Store recordings in RECORDS_DIR
    out_path = RECORDS_DIR / fname
    job_id = str(uuid.uuid4())
    rec = HWAccelRecorder(device=device, output_file=str(out_path))
    await run_in_threadpool(rec.start_recording_hw, codec)
    _jobs[job_id] = rec
    _log.info("▶ recording %s → %s (%s)", device, out_path, job_id)
    return {"job": job_id, "file": str(out_path)}


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


@router.get("/ndi_stream", include_in_schema=False)
async def ndi_stream(
    source: str = Query("camera1", description="NDI source name"),
    width:  int = Query(1280),
    height: int = Query(720),
    fps:    int = Query(30),
):
    """
    (GET /hwcapture/ndi_stream?source=MyNDICam&width=1280&height=720&fps=30)
    
    MJPEG-wrapped NDI feed:
      ffmpeg -f libndi_newtek -i <source> → MJPEG multipart.
    """
    cmd = shlex.split(
        f"{_FFMPEG} -loglevel error "
        f"-f libndi_newtek -i {source} "
        f"-vf scale={width}:{height},format=yuv420p "
        "-f mjpeg -q:v 7 -"
    )
    gen = _mjpeg_generator(cmd)
    return StreamingResponse(gen,
                             media_type="multipart/x-mixed-replace; boundary=frame")


@router.get("/stream_mjpeg", include_in_schema=False)
async def stream_mjpeg(
    device: str = Query("/dev/video0"),
    quality: int = Query(80)
):
    boundary = "--frame"
    generator = (
        boundary.encode() + b"\r\n"
        + b"Content-Type: image/jpeg\r\n\r\n"
        + frame
        + b"\r\n"
        for frame in stream_jpeg_frames(device, quality)
    )
    return StreamingResponse(
        generator,
        media_type="multipart/x-mixed-replace; boundary=frame"
    )