#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
video/ws.py

→ /ws/control   – JSON control & status (list_devices, start_record, stop_record)
→ /ws/webrtc    – SDP signaling for ultra-low-latency WebRTC preview
"""
import asyncio
import json
import logging
import time
import fractions
import cv2
import queue
import numpy as np

from typing import Any, Dict, Set, Optional

from fastapi import Query, APIRouter, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import StreamingResponse, JSONResponse
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from av import VideoFrame

from video.modules.hwcapture.hwcapture import list_video_devices, HWAccelRecorder, stream_jpeg_frames


class WSResp:
    ERROR_UNKNOWN     = {"event":"error","data":"unknown action"}
    @staticmethod
    def device_list(devs):
        return {"event":"device_list","data":devs}
    @staticmethod
    def recording_started(fname):
        return {"event":"recording_started","data":{"file":fname}}
    @staticmethod
    def recording_stopped():
        return {"event":"recording_stopped","data":{}}
    @staticmethod
    def preview_settings_changed(settings):
        return {"event":"preview_settings","data":settings}
    @staticmethod
    def overlay_toggled(name, enabled):
        return {"event":"overlay_toggled","data":{"overlay":name,"enabled":enabled}}
    @staticmethod
    def stream_selected(feed, device):
        return {"event":"stream_selected","data":{"feed":feed,"device":device}}
        

router = APIRouter(prefix="/ws")
_log = logging.getLogger("video.ws")


# ──────────── Helpers ───────────────────────────────────────────────
class FramePool:
    def __init__(self, width: int, height: int, pool_size: int = 5):
        self._w, self._h = width, height
        self._pool = queue.Queue(maxsize=pool_size)
        for _ in range(pool_size):
            buf = np.zeros((height, width, 3), dtype=np.uint8)
            self._pool.put(buf)

    def get(self) -> np.ndarray:
        try:
            return self._pool.get_nowait()
        except queue.Empty:
            # pool exhausted, rare, but allocate
            return np.zeros((self._h, self._w, 3), dtype=np.uint8)

    def put(self, buf: np.ndarray) -> None:
        if not self._pool.full():
            self._pool.put(buf)


# ──────────── Control WebSocket ───────────────────────────────────────────────
_control_clients: Set[WebSocket] = set()
_clients_lock = asyncio.Lock()


# one recorder per "feed" (e.g. "main", "aux", …)
_recorders: Dict[str, HWAccelRecorder] = {}
# per-feed status‐broadcast tasks so we can stop them later
_status_tasks: Dict[str, asyncio.Task] = {}
_recording_lock = asyncio.Lock()


# one pool for 1080p@60
_video_pool = FramePool(width=1920, height=1080, pool_size=3)


@router.websocket("/control")
async def ws_control(ws: WebSocket):
    await ws.accept()
    async with _clients_lock:
        _control_clients.add(ws)
    try:
        while True:
            try:
                text = await ws.receive_text()
                cmd  = json.loads(text)
            except json.JSONDecodeError:
                await ws.send_json(WSResp.ERROR_UNKNOWN)
                continue

            action = cmd.get("action")
            if action == "list_devices":
                devices = list_video_devices()
                await ws.send_json( WSResp.device_list(devices) )
                
            elif action == "start_record":
                # cmd should include cmd["feed"], cmd["device"], cmd["filename"], cmd["codec"]
                await _start_record(cmd, ws)
                
            elif action == "stop_record":
                # cmd must include cmd["feed"]
                await _stop_record(cmd, ws)
                                
            # ---- new UI hooks ----
            elif action == "select_stream":
                # { feed: "main"|"aux", device:"/dev/video1" }
                feed   = cmd["feed"]
                device = cmd["device"]
                # you could reconfigure your CameraTrack here…
                await _broadcast_control(WSResp.stream_selected(feed, device))

            elif action == "set_preview":
                # { width, height, fps }
                settings = {
                  "width": cmd["width"],
                  "height": cmd["height"],
                  "fps": cmd["fps"]
                }
                # apply to your VideoStreamTrack if you support dynamic resize
                await _broadcast_control(WSResp.preview_settings_changed(settings))

            elif action == "toggle_overlay":
                # { overlay:"focusPeaking"|"zebras"|..., enabled:true|false }
                name    = cmd["overlay"]
                enabled = cmd["enabled"]
                # apply on backend if desired…
                await _broadcast_control(WSResp.overlay_toggled(name, enabled))

            else:
                await ws.send_json( WSResp.ERROR_UNKNOWN )
    except WebSocketDisconnect:
        pass
    finally:
        async with _clients_lock:
            _control_clients.discard(ws)

async def _start_record(cmd: Dict[str,Any], ws: WebSocket):
    """
    cmd = {
      feed: "main"|"aux"|…,
      device: "/dev/video0",
      filename: "capture.mp4",
      codec: "h264"
    }
    """
    async with _recording_lock:
        feed = cmd.get("feed", "main")
        if feed in _recorders:
            return await ws.send_json(WSResp.ERROR_UNKNOWN)
            
        device   = cmd.get("device", "/dev/video0")
        codec    = cmd.get("codec",  "h264")
        filename = cmd.get("filename", f"{feed}.mp4")
        timecode = cmd.get("timecode", "00:00:00:00")

        rec = HWAccelRecorder(device=device, output_file=filename, metadata_timecode=timecode)
        _recorders[feed] = rec

        # start recording
        await asyncio.to_thread(rec.start_recording_hw, codec)
        await _broadcast_control(WSResp.recording_started(filename))

        # spawn a status‐loop for this feed
        async def status_loop():
            start = time.time()
            while feed in _recorders:
                elapsed = time.time() - start
                await _broadcast_control({
                    "event":"recording_status",
                    "data":{"feed":feed, "elapsed":elapsed}
                })
                await asyncio.sleep(1)

        _status_tasks[feed] = asyncio.create_task(status_loop())

async def _stop_record(cmd: Dict[str,Any], ws: WebSocket):
    """
    cmd = { feed: "main"|"aux"|… }
    """
    async with _recording_lock:
        feed = cmd.get("feed", "main")
        rec = _recorders.pop(feed, None)
        if not rec:
            return await ws.send_json(WSResp.ERROR_UNKNOWN)

        # stop it
        await asyncio.to_thread(rec.stop_recording)

        # cancel its status‐loop
        task = _status_tasks.pop(feed, None)
        if task:
            task.cancel()

        await _broadcast_control(WSResp.recording_stopped())
        
        
async def _broadcast_control(msg: Dict[str,Any]):
    async with _clients_lock:
        for client in set(_control_clients):
            try:
                await client.send_json(msg)
            except:
                _control_clients.discard(client)


# ──────────── WebRTC Preview ────────────────────────────────────────────────
class CameraTrack(VideoStreamTrack):
    def __init__(self, device: str, width: int, height: int, fps: int, pool: FramePool):
        super().__init__()
        self.cap = cv2.VideoCapture(device)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.cap.set(cv2.CAP_PROP_FPS, fps)

        self._pool = pool
        self._video_frame = VideoFrame(width=width, height=height, format="bgr24")
        self.pts = 0
        self.interval_us = int(1_000_000 / fps)

    async def recv(self) -> VideoFrame:
        await asyncio.sleep(self.interval_us / 1_000_000)

        # grab a buffer from pool
        buf = self._pool.get()
        ret, frame = self.cap.read()
        if not ret:
            self._pool.put(buf)
            raise asyncio.CancelledError

        # copy into pooled buffer
        np.copyto(buf, frame)

        # update VideoFrame in place
        self._video_frame.planes[0].update(buf)
        self._video_frame.pts = self.pts
        self._video_frame.time_base = fractions.Fraction(1, 1_000_000)
        self.pts += self.interval_us

        # return buffer back to pool after it's consumed by aiortc
        # note: aiortc will make its own reference if needed
        self._pool.put(buf)

        return self._video_frame

    def stop(self):
        super().stop()
        self.cap.release()


@router.post("/webrtc")
async def offer(request: Request):
    """
    Exchange SDP offer/answer. Client POSTs:
        { "sdp": "...", "type": "offer" }
    Returns:
        { "sdp": "...", "type": "answer" }
    """
    params = await request.json()
    offer  = RTCSessionDescription(sdp=params["sdp"], type=params["type"])

    pc = RTCPeerConnection()
    pc_id = f"PeerConnection-{id(pc)}"
    _log.info(f"{pc_id} Created for {request.client}")

    track = CameraTrack(device="/dev/video0", width=1920, height=1080, fps=60, pool=_video_pool)
    pc.addTrack(track)

    @pc.on("connectionstatechange")
    async def on_state():
        _log.info(f"{pc_id} State: {pc.connectionState}")
        if pc.connectionState in ("failed","closed","disconnected"):
            await pc.close()
            track.stop()

    await pc.setRemoteDescription(offer)
    answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    return {"sdp": pc.localDescription.sdp, "type": pc.localDescription.type}
    

# ──────────── Simple MJPEG preview ────────────
@router.get(
    "/preview",
    include_in_schema=False
)
async def preview_mjpeg(
    device: str = Query("/dev/video0", description="V4L2 device"),
    quality: int = Query(80, description="JPEG quality (0–100)"),
):
    """
    MJPEG preview endpoint with a cheeky fallback if the camera is unavailable.
    """
    # try to open the camera
    cap = cv2.VideoCapture(device)
    if not cap.isOpened():
        cap.release()
        # lazy-load HTMLResponse only on error
        from fastapi.responses import HTMLResponse

        html = """
        <html>
          <head>
            <title>No Signal</title>
            <style>
              body { background: #000; color: #fff; text-align: center; font-family: sans-serif; }
              h1 { margin-top: 2em; }
              p  { font-size: 1.2em; }
            </style>
          </head>
          <body>
            <h1>🎬 Oops... No Signal!</h1>
            <p>Your camera seems to be on a coffee break… ☕</p>
            <img 
              src="https://media.giphy.com/media/3o6ZsY1skhUgE5r6Lm/giphy.gif" 
              alt="No signal GIF" 
              style="max-width:80%; margin-top:1em;"
            />
          </body>
        </html>
        """
        return HTMLResponse(html, status_code=200)

    # otherwise, release and stream as MJPEG
    cap.release()
    boundary = "frame"
    return StreamingResponse(
        stream_jpeg_frames(device=device, quality=quality),
        media_type=f"multipart/x-mixed-replace; boundary={boundary}"
    )


# ──────────── Recording status ────────────
@router.get(
    "/status",
    summary="Current recording status",
    response_class=JSONResponse
)
async def ws_status():
    """
    Returns JSON like:
      {
        "recorders": {
            "main": {"recording": true, "file": "main.mp4"},
            "aux":  {"recording": false, "file": "aux.mp4"}
        }
      }
    """
    return {
        "recorders": {
            feed: {"recording": rec.recording, "file": rec.output_file}
            for feed, rec in _recorders.items()
        }
    }