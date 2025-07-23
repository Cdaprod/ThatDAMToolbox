#!/usr/bin/env python3
"""
video/ws.py  – tiny pub-sub hub for WebSocket clients

Mount once (already done in video.api) and call:

    await broadcast("job_update", {"id": job_id, "progress": 0.42})

from anywhere in the backend.  All connected front-end clients receive:

    { "event": "job_update", "data": { … } }

If you need to push binary frames:

    await broadcast_bytes(b"\xff\xd8…")   # raw JPEG

Nothing else in the stack needs to change.
"""

from __future__ import annotations
import asyncio
import json
from typing import Any, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
_clients: Set[WebSocket] = set()
_lock = asyncio.Lock()                   # protects _clients

PING_INTERVAL = 20       # seconds   – tune to fit your infra
PING_TIMEOUT  = 10       # seconds   – drop if no pong in time


# ---------------------------------------------------------------------------#
# WebSocket endpoint                                                         #
# ---------------------------------------------------------------------------#
@router.websocket("/ws")                # →  ws://host:port/ws
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    async with _lock:
        _clients.add(ws)

    # fire-and-forget heartbeat task
    ping_task = asyncio.create_task(_ping_loop(ws))

    # confirm connection (nice for client-side logs)
    await ws.send_json({"event": "connected", "data": {"msg": "hi 👋"}})

    try:
        # basic echo so devs can poke around from the browser console
        while True:
            msg = await ws.receive_text()
            # ignore pings: FastAPI replies automatically when we call .send_json
            try:
                parsed = json.loads(msg)
            except Exception:
                parsed = msg
            await ws.send_json({"event": "echo", "data": parsed})
    except WebSocketDisconnect:
        pass
    finally:
        ping_task.cancel()
        async with _lock:
            _clients.discard(ws)


# ---------------------------------------------------------------------------#
# Public helpers                                                             #
# ---------------------------------------------------------------------------#
async def broadcast(event: str, payload: Any) -> None:
    """
    Send one **JSON** message to *all* connected clients.

    Usage:
        await broadcast("job_update", {"id": "...", "progress": 0.5})
    """
    dead: list[WebSocket] = []
    async with _lock:
        for ws in _clients:
            try:
                await ws.send_json({"event": event, "data": payload})
            except Exception:
                dead.append(ws)
        for ws in dead:
            _clients.discard(ws)


async def broadcast_bytes(blob: bytes) -> None:
    """
    Push a binary payload (e.g. JPEG frame) to every client that is
    currently subscribed.  Front-end must handle the binary type.
    """
    dead: list[WebSocket] = []
    async with _lock:
        for ws in _clients:
            try:
                await ws.send_bytes(blob)
            except Exception:
                dead.append(ws)
        for ws in dead:
            _clients.discard(ws)


# ---------------------------------------------------------------------------#
# Internal heartbeat                                                         #
# ---------------------------------------------------------------------------#
async def _ping_loop(ws: WebSocket) -> None:
    """
    Send periodic pings; drop the connection if the client stops replying.
    """
    try:
        while True:
            await asyncio.sleep(PING_INTERVAL)
            try:
                await ws.send_json({"event": "ping"})
                # wait for client pong (or any message) within timeout
                await asyncio.wait_for(ws.receive_text(), timeout=PING_TIMEOUT)
            except asyncio.TimeoutError:
                await ws.close(code=1001)  # going away / idle
                break
    except Exception:
        # any failure → connection will be cleaned up by caller
        pass