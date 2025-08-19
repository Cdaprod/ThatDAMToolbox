"""
video/modules/hwcapture/routes.py
FastAPI endpoints:

GET  /hwcapture/devices             – JSON list of /dev/video? capabilities
GET  /hwcapture/stream              – MJPEG preview  (img tag friendly)
POST /hwcapture/hls                 – start ffmpeg HLS loop
GET  /hwcapture/live/stream.m3u8    – HLS playlist
GET  /hwcapture/live/{segment}.ts   – HLS segments
POST /hwcapture/record              – start HW-encoded recording
DEL  /hwcapture/record/{job_id}     – stop recording
"""

from __future__ import annotations

import io
import json
import logging
import os
import shlex
import subprocess
import threading
import uuid
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse, StreamingResponse
from starlette.concurrency import run_in_threadpool

from video.paths import get_module_path

from .hwcapture import HWAccelRecorder
from .hwcapture import record as cli_record
from .hwcapture import stream_jpeg_frames

router = APIRouter(prefix="/hwcapture", tags=["hwcapture"])
_log = logging.getLogger("video.hwcapture")
_CAPTURE_URL = os.getenv("CAPTURE_DAEMON_URL", "http://localhost:9000")


# Use module-registered directories!
STREAMS_DIR = get_module_path("hwcapture", "streams")
RECORDS_DIR = get_module_path("hwcapture", "records")
LIVE_DIR = STREAMS_DIR / "live"


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
                boundary + b"\r\n" + b"Content-Type: image/jpeg\r\n\r\n" + jpg + b"\r\n"
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
    """Return capture-daemon's device list.

    The capture-daemon exposes its own `/devices` endpoint which
    enumerates cameras and capabilities.  We proxy that list so the
    web app and other consumers see a single authoritative source.

    Example:
        curl http://localhost:8080/hwcapture/devices
    """
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{_CAPTURE_URL}/devices")
        r.raise_for_status()
        return r.json()


@router.get("/features")
async def features():
    async with httpx.AsyncClient() as client:
        r = await client.get(f"{_CAPTURE_URL}/features")
        r.raise_for_status()
        return r.json()


@router.post("/webrtc")
async def webrtc_offer(request: Request):
    payload = await request.json()
    async with httpx.AsyncClient() as client:
        r = await client.post(f"{_CAPTURE_URL}/webrtc/offer", json=payload)
        r.raise_for_status()
        return r.json()


@router.get("/stream", include_in_schema=False)
async def stream(
    device: str = Query("/dev/video0", description="V4L2 device"),
    width: int = Query(640),
    height: int = Query(360),
    fps: int = Query(20),
):
    cmd = shlex.split(
        f"ffmpeg -loglevel error -f v4l2 -video_size {width}x{height} "
        f"-framerate {fps} -i {device} "
        "-vf format=yuv420p "
        "-f mjpeg -q:v 7 -"
    )
    gen = _mjpeg_generator(cmd)
    return StreamingResponse(
        gen, media_type="multipart/x-mixed-replace; boundary=frame"
    )


_jobs: dict[str, HWAccelRecorder] = {}
_hls_proc: Optional[subprocess.Popen] = None


@router.post("/hls")
async def start_hls(device: str = Query("/dev/video0")):
    """Launch ffmpeg to produce an HLS playlist from ``device``.

    Output is written under ``LIVE_DIR`` and exposed via ``/live`` endpoints.
    """
    global _hls_proc
    if _hls_proc and _hls_proc.poll() is None:
        return {"status": "running"}

    LIVE_DIR.mkdir(parents=True, exist_ok=True)
    playlist = LIVE_DIR / "stream.m3u8"
    cmd = [
        "ffmpeg",
        "-loglevel",
        "error",
        "-f",
        "v4l2",
        "-i",
        device,
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        "-f",
        "hls",
        "-hls_time",
        "1",
        "-hls_list_size",
        "3",
        "-hls_flags",
        "delete_segments",
        str(playlist),
    ]
    _hls_proc = subprocess.Popen(cmd)
    _log.info("▶ HLS streaming %s → %s", device, playlist)
    return {"status": "started", "playlist": str(playlist)}


@router.get("/live/stream.m3u8", include_in_schema=False)
async def hls_playlist():
    """Serve the HLS playlist produced by :func:`start_hls`."""
    return FileResponse(LIVE_DIR / "stream.m3u8")


@router.get("/live/{segment}.ts", include_in_schema=False)
async def hls_segment(segment: str):
    """Serve individual HLS segments."""
    return FileResponse(LIVE_DIR / f"{segment}.ts")


@router.post("/record")
async def start_record(
    request: Request,
    device: str | None = Query(None),
    fname: str | None = Query(None),
    codec: str | None = Query(None),
):
    """Start a hardware encoded recording.

    Accepts either query parameters or a JSON body with ``device``,
    ``fname`` and optional ``codec`` for convenience.

    Example:
        curl -X POST '/hwcapture/record?device=/dev/video0&fname=out.mp4'
    """
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    device = device or payload.get("device", "/dev/video0")
    fname = fname or payload.get("fname", "capture.mp4")
    codec = codec or payload.get("codec", "h264")

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
        _jobs[job_id] = {
            "status": "done",
            "raw": "main_raw.mp4",
            "stabilised": "main_stab.mp4",
        }

    threading.Thread(target=_worker, daemon=True).start()
    return {"job": job_id, "status": "started"}


@router.get("/ndi_stream", include_in_schema=False)
async def ndi_stream(
    source: str = Query("camera1", description="NDI source name"),
    width: int = Query(1280),
    height: int = Query(720),
    fps: int = Query(30),
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
    return StreamingResponse(
        gen, media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.get("/stream_mjpeg", include_in_schema=False)
async def stream_mjpeg(device: str = Query("/dev/video0"), quality: int = Query(80)):
    boundary = "--frame"
    generator = (
        boundary.encode()
        + b"\r\n"
        + b"Content-Type: image/jpeg\r\n\r\n"
        + frame
        + b"\r\n"
        for frame in stream_jpeg_frames(device, quality)
    )
    return StreamingResponse(
        generator, media_type="multipart/x-mixed-replace; boundary=frame"
    )
