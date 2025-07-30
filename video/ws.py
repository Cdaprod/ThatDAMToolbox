#!/usr/bin/env python3
"""
video/ws.py

→ /ws/control   – JSON control & status (list_devices, start_record, stop_record)
→ /ws/webrtc    – SDP signaling for ultra-low-latency WebRTC preview

REFACTORED: All device operations now go through hwcapture module for DRY compliance.
"""
import asyncio
import json
import logging
import time
import fractions
import base64
import numpy as np

from typing import Any, Dict, Set, Optional

from fastapi import HTTPException, Query, APIRouter, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import StreamingResponse, JSONResponse, HTMLResponse
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from av import VideoFrame

# ------ ALL hwcapture imports are via the public API ------
from video.modules.hwcapture import (
    list_video_devices, HWAccelRecorder, stream_jpeg_frames,
    record_multiple, capture_multiple, has_hw
)

router = APIRouter(prefix="/ws")
_log = logging.getLogger("video.ws")

def _no_signal_html(module: str, device: str) -> HTMLResponse:
    html = f"""
    <html>
      <head><title>{module} – No Signal</title>
        <style>
          body {{ background: #000; color: #fff; text-align: center; font-family: sans-serif; }}
          h1 {{ margin-top: 2em; }}
        </style>
      </head>
      <body>
        <h1>🎬 Oops… {module} stream unavailable!</h1>
        <p>Device <code>{device}</code> can't be opened.</p>
        <img src="https://media.giphy.com/media/3o6ZsY1skhUgE5r6Lm/giphy.gif"
             alt="No signal GIF" style="max-width:80%;margin-top:1em;" />
      </body>
    </html>
    """
    return HTMLResponse(html, status_code=200)

# ──────────── WS Event Utility ──────────────
class WSResp:
    ERROR_UNKNOWN = {"event":"error","data":"unknown action"}
    
    @staticmethod
    def device_list(devs):
        return {"event":"device_list","data":devs}
    
    @staticmethod
    def recording_started(fname):
        return {"event":"recording_started","data":{"file":fname}}
    
    @staticmethod
    def recording_stopped(feed):
        return {"event":"recording_stopped","data":{"feed": feed}}
    
    @staticmethod
    def preview_settings_changed(settings):
        return {"event":"preview_settings","data":settings}
    
    @staticmethod
    def overlay_toggled(name, enabled):
        return {"event":"overlay_toggled","data":{"overlay":name,"enabled":enabled}}
    
    @staticmethod
    def stream_selected(feed, device):
        return {"event":"stream_selected","data":{"feed":feed,"device":device}}
    
    @staticmethod
    def frame_captured(device, data):
        return {"event":"frame","device":device,"data":data}
    
    @staticmethod
    def error(message):
        return {"event":"error","data":message}

# ──────────── WebSocket State ────────────────
_control_clients: Set[WebSocket] = set()
_clients_lock = asyncio.Lock()
_recorders: Dict[str, HWAccelRecorder] = {}
_status_tasks: Dict[str, asyncio.Task] = {}
_recording_lock = asyncio.Lock()

# ──────────── Device Manager - Central abstraction ──────────────
class DeviceManager:
    """
    Centralized device management using hwcapture module.
    Eliminates duplicate device handling code across WebSocket endpoints.
    """
    
    @staticmethod
    async def get_devices():
        """Get all available devices via hwcapture."""
        return await asyncio.to_thread(list_video_devices)
    
    @staticmethod
    async def capture_single_frame(device: str) -> Optional[bytes]:
        """
        Capture a single frame from device using hwcapture abstraction.
        Returns base64-encoded JPEG or None on failure.
        """
        try:
            # Use hwcapture's stream generator for consistency
            frame_gen = stream_jpeg_frames(device=device, quality=80)
            frame_bytes = next(frame_gen)  # Get first frame
            return base64.b64encode(frame_bytes).decode("ascii")
        except Exception as e:
            _log.error(f"Frame capture failed for {device}: {e}")
            return None
    
    @staticmethod
    def validate_device(device: str) -> bool:
        """Validate device exists using hwcapture."""
        devices = list_video_devices()
        return any(dev['path'] == device for dev in devices)

# ──────────── Frame Pool Helper (optimized) ──────────────
class FramePool:
    def __init__(self, width: int, height: int, pool_size: int = 5):
        self._w, self._h = width, height
        self._pool = asyncio.Queue(maxsize=pool_size)
        for _ in range(pool_size):
            buf = np.zeros((height, width, 3), dtype=np.uint8)
            self._pool.put_nowait(buf)
    
    async def get(self) -> np.ndarray:
        try:
            return await self._pool.get()
        except Exception:
            return np.zeros((self._h, self._w, 3), dtype=np.uint8)
    
    async def put(self, buf: np.ndarray):
        if not self._pool.full():
            await self._pool.put(buf)

_video_pool = FramePool(width=1920, height=1080, pool_size=3)

# ──────────── Control WebSocket (using DeviceManager) ──────────────
@router.websocket("/control")
async def ws_control(ws: WebSocket):
    await ws.accept()
    async with _clients_lock:
        _control_clients.add(ws)
    
    try:
        while True:
            text = await ws.receive_text()
            try:
                cmd = json.loads(text)
            except json.JSONDecodeError:
                await ws.send_json(WSResp.ERROR_UNKNOWN)
                continue

            action = cmd.get("action")
            
            # --- Device list via DeviceManager ---
            if action == "list_devices":
                devices = await DeviceManager.get_devices()
                await ws.send_json(WSResp.device_list(devices))
            
            # --- Recording control via hwcapture ---
            elif action == "start_record":
                await _start_record(cmd, ws)
            elif action == "stop_record":
                await _stop_record(cmd, ws)
            
            # --- Stream control ---
            elif action == "select_stream":
                device = cmd.get("device", "/dev/video0")
                if DeviceManager.validate_device(device):
                    await _broadcast_control(WSResp.stream_selected(cmd["feed"], device))
                else:
                    await ws.send_json(WSResp.error(f"Invalid device: {device}"))
            
            elif action == "set_preview":
                settings = {
                    "width": cmd.get("width", 1920), 
                    "height": cmd.get("height", 1080), 
                    "fps": cmd.get("fps", 30)
                }
                await _broadcast_control(WSResp.preview_settings_changed(settings))
            
            elif action == "toggle_overlay":
                await _broadcast_control(WSResp.overlay_toggled(
                    cmd.get("overlay", ""), 
                    cmd.get("enabled", False)
                ))
            
            else:
                await ws.send_json(WSResp.ERROR_UNKNOWN)
                
    except WebSocketDisconnect:
        pass
    finally:
        async with _clients_lock:
            _control_clients.discard(ws)

# ──────────── Recording Control (using hwcapture) ──────────────
async def _start_record(cmd: Dict[str, Any], ws: WebSocket):
    async with _recording_lock:
        feed = cmd.get("feed", "main")
        if feed in _recorders:
            return await ws.send_json(WSResp.error("Recording already active"))
        
        device = cmd.get("device", "/dev/video0")
        if not DeviceManager.validate_device(device):
            return await ws.send_json(WSResp.error(f"Invalid device: {device}"))
        
        codec = cmd.get("codec", "h264")
        filename = cmd.get("filename", f"{feed}.mp4")
        timecode = cmd.get("timecode", None)
        
        try:
            rec = HWAccelRecorder(
                device=device, 
                output_file=filename, 
                metadata_timecode=timecode
            )
            _recorders[feed] = rec
            await asyncio.to_thread(rec.start_recording_hw, codec)
            await _broadcast_control(WSResp.recording_started(filename))
            
            # Status monitoring task
            async def status_loop():
                start = time.time()
                while feed in _recorders:
                    elapsed = time.time() - start
                    await _broadcast_control({
                        "event": "recording_status", 
                        "data": {"feed": feed, "elapsed": elapsed}
                    })
                    await asyncio.sleep(1)
            
            _status_tasks[feed] = asyncio.create_task(status_loop())
            
        except Exception as e:
            await ws.send_json(WSResp.error(f"Recording failed: {str(e)}"))

async def _stop_record(cmd: Dict[str, Any], ws: WebSocket):
    async with _recording_lock:
        feed = cmd.get("feed", "main")
        rec = _recorders.pop(feed, None)
        if not rec:
            return await ws.send_json(WSResp.error("No active recording"))
        
        try:
            await asyncio.to_thread(rec.stop_recording)
            task = _status_tasks.pop(feed, None)
            if task:
                task.cancel()
            await _broadcast_control(WSResp.recording_stopped(feed))
        except Exception as e:
            await ws.send_json(WSResp.error(f"Stop failed: {str(e)}"))

async def _broadcast_control(msg: Dict[str, Any]):
    async with _clients_lock:
        for client in set(_control_clients):
            try:
                await client.send_json(msg)
            except Exception:
                _control_clients.discard(client)

# ──────────── Camera/Preview WS (using DeviceManager) ──────────────
@router.websocket("/camera")
async def ws_camera(ws: WebSocket):
    await ws.accept()
    _log.info("Camera WS client connected")
    
    try:
        await ws.send_json({"event": "camera_ws_ready"})
        
        while True:
            msg = await ws.receive_text()
            try:
                data = json.loads(msg)
            except Exception as e:
                await ws.send_json(WSResp.error(f"JSON parse: {str(e)}"))
                continue

            action = data.get("action")
            
            if action == "list_devices":
                devices = await DeviceManager.get_devices()
                await ws.send_json(WSResp.device_list(devices))
            
            elif action == "capture_frame":
                device = data.get("device", "/dev/video0")
                if not DeviceManager.validate_device(device):
                    await ws.send_json(WSResp.error(f"Invalid device: {device}"))
                    continue
                
                frame_data = await DeviceManager.capture_single_frame(device)
                if frame_data:
                    await ws.send_json(WSResp.frame_captured(device, frame_data))
                else:
                    await ws.send_json(WSResp.error(f"Frame capture failed: {device}"))
            
            else:
                await ws.send_json(WSResp.error(f"Unknown action: {action}"))
                
    except WebSocketDisconnect:
        _log.info("Camera WS client disconnected")
    finally:
        try:
            await ws.close()
        except Exception:
            pass

# ──────────── MJPEG Preview (direct hwcapture call) ──────────────
@router.get("/preview", include_in_schema=False)
async def preview_mjpeg(
    device: str = Query("/dev/video0", description="V4L2 device"),
    quality: int = Query(80, description="JPEG quality (0–100)")
):
    # Validate device first
    if not DeviceManager.validate_device(device):
        return _no_signal_html("hwcapture", device)
    
    # Use hwcapture's stream generator directly
    return StreamingResponse(
        stream_jpeg_frames(device=device, quality=quality),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

# ──────────── Recording status ──────────────
@router.get("/status", summary="Current recording status", response_class=JSONResponse)
async def ws_status():
    return {
        "recorders": {
            feed: {"recording": rec.recording, "file": rec.output_file}
            for feed, rec in _recorders.items()
        },
        "hardware_available": has_hw()
    }

# ──────────── WebRTC Preview (using hwcapture for device validation) ──────────
class CameraTrack(VideoStreamTrack):
    """WebRTC camera track with hwcapture integration."""
    
    def __init__(self, device: str, width: int, height: int, fps: int, pool: FramePool):
        super().__init__()
        
        # Validate device via hwcapture
        if not DeviceManager.validate_device(device):
            raise ValueError(f"Invalid device: {device}")
        
        # Use OpenCV for WebRTC (real-time requirement)
        # but validate device capabilities via hwcapture first
        import cv2
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
        buf = await self._pool.get()
        
        ret, frame = self.cap.read()
        if not ret:
            await self._pool.put(buf)
            raise asyncio.CancelledError
        
        np.copyto(buf, frame)
        self._video_frame.planes[0].update(buf)
        self._video_frame.pts = self.pts
        self._video_frame.time_base = fractions.Fraction(1, 1_000_000)
        self.pts += self.interval_us
        
        await self._pool.put(buf)
        return self._video_frame
    
    def stop(self):
        super().stop()
        self.cap.release()

@router.post("/webrtc")
async def offer(request: Request):
    params = await request.json()
    offer = RTCSessionDescription(sdp=params["sdp"], type=params["type"])
    pc = RTCPeerConnection()
    pc_id = f"PeerConnection-{id(pc)}"
    
    _log.info(f"{pc_id} Created for {request.client}")
    
    try:
        track = CameraTrack(
            device="/dev/video0", 
            width=1920, 
            height=1080, 
            fps=60, 
            pool=_video_pool
        )
        pc.addTrack(track)
        
        @pc.on("connectionstatechange")
        async def on_state():
            _log.info(f"{pc_id} State: {pc.connectionState}")
            if pc.connectionState in ("failed", "closed", "disconnected"):
                await pc.close()
                track.stop()
        
        await pc.setRemoteDescription(offer)
        answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        
        return {
            "sdp": pc.localDescription.sdp, 
            "type": pc.localDescription.type
        }
        
    except ValueError as e:
        _log.error(f"WebRTC setup failed: {e}")
        raise HTTPException(status_code=400, detail=str(e))