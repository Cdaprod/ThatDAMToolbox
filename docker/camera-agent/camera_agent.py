#!/usr/bin/env python3
"""
ThatDAM Camera-Agent
--------------------
• tries to load a persisted config from /data/agent.yaml
• otherwise discovers the first gateway advertising _thatdam._tcp via mDNS
• optionally falls back to a statically-defined GATEWAY_URL env var
• registers itself, stores the returned creds, then begins streaming JPEG
  frames over a WebSocket at /ws/camera?deviceId=<id>
• reconnects forever with back-off; CTRL-C / SIGTERM exits cleanly
"""
import asyncio, base64, json, os, signal, time
from pathlib import Path
from typing import Optional

import aiohttp
import cv2
import websockets
from aiortc import RTCPeerConnection, RTCSessionDescription, VideoStreamTrack
import av
from zeroconf.asyncio import AsyncServiceBrowser, AsyncZeroconf

###############################################################################
# Config helpers
###############################################################################

DATA_DIR = Path(os.getenv("DATA_DIR", "/data"))
CFG_PATH = DATA_DIR / "agent.yaml"
SERVICE_TYPE = "_thatdam._tcp.local."
REGISTER_PATH = "/api/devices/register"
WELL_KNOWN = "/.well-known/thatdam.json"

# Defaults can be overridden via env for quick tests
DEVICE_SERIAL = os.getenv("DEVICE_SERIAL", os.uname().nodename)
CAPTURE_ID = int(os.getenv("VIDEO_DEVICE_IDX", "0"))
FRAME_W = int(os.getenv("FRAME_W", "640"))
FRAME_H = int(os.getenv("FRAME_H", "360"))
FPS = float(os.getenv("FPS", "10"))
STREAM_MODE = os.getenv("STREAM_MODE")

###############################################################################
# Utility I/O
###############################################################################

import yaml  # late import so PyYAML only needed in the image


def load_cfg() -> Optional[dict]:
    if CFG_PATH.exists():
        with CFG_PATH.open() as f:
            return yaml.safe_load(f)
    return None


def persist_cfg(cfg: dict) -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    with CFG_PATH.open("w") as f:
        yaml.safe_dump(cfg, f)


###############################################################################
# Discovery / registration
###############################################################################


async def discover_gateway(timeout: int = 8) -> Optional[str]:
    """Return first host (e.g. dam-pi.local) that advertises SERVICE_TYPE."""
    found: asyncio.Future[str | None] = asyncio.get_event_loop().create_future()

    async def on_service(state, _type, name):
        if state.is_added():
            host = name.rstrip("." + SERVICE_TYPE)
            if not found.done():
                found.set_result(host)

    async with AsyncZeroconf() as azc:
        browser = AsyncServiceBrowser(azc.zeroconf, SERVICE_TYPE, handlers=[on_service])
        try:
            return await asyncio.wait_for(found, timeout)
        except asyncio.TimeoutError:
            return None
        finally:
            await browser.async_cancel()


async def fetch_well_known(host: str) -> dict:
    async with aiohttp.ClientSession() as s:
        async with s.get(f"http://{host}{WELL_KNOWN}", timeout=4) as r:
            r.raise_for_status()
            return await r.json()


async def register(host: str, token: str) -> dict:
    payload = {
        "serial": DEVICE_SERIAL,
        "model": "raspberrypi-camera",
        "stream_mode": STREAM_MODE or "ws-jpeg",
    }
    async with aiohttp.ClientSession() as s:
        async with s.post(
            f"http://{host}{REGISTER_PATH}",
            json=payload,
            headers={"X-Token": token},
            timeout=5,
        ) as r:
            r.raise_for_status()
            return await r.json()


async def ensure_config() -> dict:
    """Load existing configuration or perform discovery / registration."""
    cfg = load_cfg()
    if cfg:
        return cfg

    # 1 · try mDNS discovery
    gw_host = await discover_gateway()
    if not gw_host:
        gw_host = os.getenv("GATEWAY_URL")  # last-ditch static override
    if not gw_host:
        raise RuntimeError("No gateway discovered and GATEWAY_URL not set")

    meta = await fetch_well_known(gw_host)
    cfg = await register(gw_host, meta["reg_token"])
    cfg["gateway"] = gw_host
    cfg["stream_mode"] = STREAM_MODE or "ws-jpeg"
    persist_cfg(cfg)
    return cfg


###############################################################################
# Video capture loops
###############################################################################


async def cam_loop_ws(cfg: dict):
    device_id = cfg["device_id"]
    ws_url = f"ws://{cfg['gateway']}:8080/ws/camera?deviceId={device_id}"

    cap = cv2.VideoCapture(CAPTURE_ID)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
    cap.set(cv2.CAP_PROP_FPS, FPS)

    if not cap.isOpened():
        raise RuntimeError("Unable to open /dev/video*")

    try:
        async for backoff in reconnect(backoff_initial=1, backoff_max=30):
            try:
                async with websockets.connect(ws_url, max_queue=1) as ws:
                    print(f"[agent] connected → {ws_url}")
                    while True:
                        ret, frame = cap.read()
                        if not ret:
                            await asyncio.sleep(0.5)
                            continue
                        _, buf = cv2.imencode(
                            ".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 80]
                        )
                        await ws.send(
                            json.dumps(
                                {
                                    "device": device_id,
                                    "ts": int(time.time() * 1000),
                                    "frame": base64.b64encode(buf).decode(),
                                }
                            )
                        )
                        await asyncio.sleep(1 / FPS)
            except (websockets.ConnectionClosed, OSError) as e:
                print(f"[agent] ws disconnect: {e}")
                await asyncio.sleep(backoff)
    finally:
        cap.release()


class OpenCVCaptureTrack(VideoStreamTrack):
    """VideoStreamTrack that grabs frames from OpenCV."""

    def __init__(self, cap: cv2.VideoCapture):
        super().__init__()
        self.cap = cap

    async def recv(self):
        pts, time_base = await self.next_timestamp()
        ret, frame = self.cap.read()
        if not ret:
            await asyncio.sleep(1 / FPS)
            return await self.recv()
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame = av.VideoFrame.from_ndarray(frame, format="rgb24")
        frame.pts = pts
        frame.time_base = time_base
        return frame


async def cam_loop_webrtc(cfg: dict):
    device_id = cfg["device_id"]
    url = f"http://{cfg['gateway']}:8080/webrtc?deviceId={device_id}"

    cap = cv2.VideoCapture(CAPTURE_ID)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, FRAME_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, FRAME_H)
    cap.set(cv2.CAP_PROP_FPS, FPS)

    if not cap.isOpened():
        raise RuntimeError("Unable to open /dev/video*")

    try:
        async for backoff in reconnect(backoff_initial=1, backoff_max=30):
            pc = RTCPeerConnection()
            track = OpenCVCaptureTrack(cap)
            pc.addTrack(track)
            try:
                offer = await pc.createOffer()
                await pc.setLocalDescription(offer)
                async with aiohttp.ClientSession() as s:
                    async with s.post(
                        url,
                        json={
                            "sdp": pc.localDescription.sdp,
                            "type": pc.localDescription.type,
                        },
                        timeout=5,
                    ) as r:
                        r.raise_for_status()
                        ans = await r.json()
                await pc.setRemoteDescription(
                    RTCSessionDescription(ans["sdp"], ans["type"])
                )
                print(f"[agent] WebRTC connected → {url}")
                while pc.connectionState not in ("failed", "closed"):
                    await asyncio.sleep(1)
            except Exception as e:
                print(f"[agent] WebRTC error: {e}")
                await asyncio.sleep(backoff)
            finally:
                await pc.close()
    finally:
        cap.release()


def reconnect(backoff_initial=1, backoff_max=30):
    backoff = backoff_initial
    while True:
        yield backoff
        backoff = min(backoff * 2, backoff_max)


###############################################################################
# Main
###############################################################################


async def main():
    cfg = await ensure_config()
    mode = STREAM_MODE or cfg.get("stream_mode", "ws-jpeg")
    if mode == "webrtc":
        await cam_loop_webrtc(cfg)
    else:
        await cam_loop_ws(cfg)


def shutdown(loop):
    for t in asyncio.all_tasks(loop):
        t.cancel()


if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, lambda: shutdown(loop))
    try:
        loop.run_until_complete(main())
    except asyncio.CancelledError:
        pass
    finally:
        loop.close()
