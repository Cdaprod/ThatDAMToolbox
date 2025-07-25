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
import fractions
import cv2

from typing import Any, Dict, Set, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
from av import VideoFrame

from video.modules.hwcapture.hwcapture import list_video_devices, HWAccelRecorder

router = APIRouter(prefix="/ws")
_log = logging.getLogger("video.ws")

# ──────────── Control WebSocket ───────────────────────────────────────────────
_control_clients: Set[WebSocket] = set()
_clients_lock = asyncio.Lock()
_recorder: Optional[HWAccelRecorder] = None
_recording_lock = asyncio.Lock()

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
                await ws.send_json({"event":"error","data":"invalid JSON"})
                continue

            action = cmd.get("action")
            if action == "list_devices":
                devices = list_video_devices()
                await ws.send_json({"event":"device_list","data":devices})
            elif action == "start_record":
                await _start_record(cmd, ws)
            elif action == "stop_record":
                await _stop_record(ws)
            else:
                await ws.send_json({"event":"error","data":f"Unknown action {action}"})
    except WebSocketDisconnect:
        pass
    finally:
        async with _clients_lock:
            _control_clients.discard(ws)

async def _start_record(cmd: Dict[str,Any], ws: WebSocket):
    global _recorder
    async with _recording_lock:
        if _recorder:
            return await ws.send_json({"event":"error","data":"Already recording"})
        device   = cmd.get("device", "/dev/video0")
        codec    = cmd.get("codec",  "h264")
        filename = cmd.get("filename", "record.mp4")
        rec = HWAccelRecorder(device=device, output_file=filename)
        _recorder = rec
        await asyncio.to_thread(rec.start_recording_hw, codec)
        await _broadcast_control({"event":"recording_started","data":{"file":filename}})

async def _stop_record(ws: WebSocket):
    global _recorder
    async with _recording_lock:
        if not _recorder:
            return await ws.send_json({"event":"error","data":"Not recording"})
        rec = _recorder
        _recorder = None
        await asyncio.to_thread(rec.stop_recording)
        await _broadcast_control({"event":"recording_stopped","data":{}})

async def _broadcast_control(msg: Dict[str,Any]):
    async with _clients_lock:
        for client in set(_control_clients):
            try:
                await client.send_json(msg)
            except:
                _control_clients.discard(client)


# ──────────── WebRTC Preview ────────────────────────────────────────────────
class CameraTrack(VideoStreamTrack):
    """
    VideoStreamTrack that pulls frames from OpenCV for WebRTC.
    """
    def __init__(self, device: str, width: int, height: int, fps: int):
        super().__init__()
        self.cap = cv2.VideoCapture(device)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        self.cap.set(cv2.CAP_PROP_FPS, fps)
        self.pts = 0
        self.interval_us = int(1_000_000 / fps)

    async def recv(self) -> VideoFrame:
        await asyncio.sleep(self.interval_us / 1_000_000)
        ret, frame = self.cap.read()
        if not ret:
            raise asyncio.CancelledError
        vframe = VideoFrame.from_ndarray(frame, format="bgr24")
        vframe.pts = self.pts
        vframe.time_base = fractions.Fraction(1, 1_000_000)
        self.pts += self.interval_us
        return vframe

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

    track = CameraTrack(device="/dev/video0", width=1920, height=1080, fps=60)
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