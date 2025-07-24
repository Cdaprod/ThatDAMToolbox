#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
video/ws.py
──────────────────────────────────────────────────────────────────────────────
Tiny pub-sub hub for Web-Socket clients.

•  Mount once (already done in video.api):
       app.include_router(ws.router)

•  Emit events from anywhere in the backend:
       await ws.broadcast("job_update", {"id": job_id, "progress": 0.42})

Clients receive JSON messages shaped like:
       { "event": "<event>", "data": { … } }

Binary frames are supported via:
       await ws.broadcast_bytes(b"\xff\xd8…")        # raw JPEG, etc.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

# --------------------------------------------------------------------------- #
# Internal state                                                              #
# --------------------------------------------------------------------------- #
_router  = APIRouter()
_clients: Set[WebSocket] = set()
_lock    = asyncio.Lock()                 # protects _clients set

PING_INTERVAL = 20        # seconds
PING_TIMEOUT  = 10        # seconds


# --------------------------------------------------------------------------- #
# Web-Socket endpoint                                                         #
# --------------------------------------------------------------------------- #
@_router.websocket("/ws")                 # →  ws://<host>:<port>/ws
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    async with _lock:
        _clients.add(ws)

    # fire-and-forget heartbeat
    ping_task = asyncio.create_task(_ping_loop(ws))

    # greet client (nice for console debugging)
    await ws.send_json({"event": "connected", "data": {"msg": "hi 👋"}})

    try:
        # simple echo so devs can test from browser console
        while True:
            msg = await ws.receive_text()
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


# --------------------------------------------------------------------------- #
# Public helpers                                                              #
# --------------------------------------------------------------------------- #
async def _broadcast_json(payload: dict[str, Any]) -> None:
    dead: list[WebSocket] = []
    async with _lock:
        for ws in _clients:
            try:
                await ws.send_json(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            _clients.discard(ws)


async def broadcast(event: str, data: Any) -> None:
    """Push a JSON event to **all** connected clients."""
    await _broadcast_json({"event": event, "data": data})


async def broadcast_bytes(blob: bytes) -> None:
    """Push a binary payload (e.g. JPEG) to every connected client."""
    dead: list[WebSocket] = []
    async with _lock:
        for ws in _clients:
            try:
                await ws.send_bytes(blob)
            except Exception:
                dead.append(ws)
        for ws in dead:
            _clients.discard(ws)


# --------------------------------------------------------------------------- #
# Internal heartbeat                                                          #
# --------------------------------------------------------------------------- #
async def _ping_loop(ws: WebSocket) -> None:
    """Periodic ping; drop connection if client stops replying."""
    try:
        while True:
            await asyncio.sleep(PING_INTERVAL)
            try:
                await ws.send_json({"event": "ping"})
                # wait for any response within timeout
                await asyncio.wait_for(ws.receive_text(), timeout=PING_TIMEOUT)
            except asyncio.TimeoutError:
                await ws.close(code=1001)  # going away / idle
                break
    except Exception:
        # any error → connection cleanup in caller
        pass


# --------------------------------------------------------------------------- #
# Facade object expected by `video.api`                                       #
# --------------------------------------------------------------------------- #
class _WSFacade:
    """Tiny wrapper so `video.api` can `from video.ws import ws`."""

    router = _router
    broadcast = staticmethod(broadcast)
    broadcast_bytes = staticmethod(broadcast_bytes)


# This is what `video.api` imports:
ws = _WSFacade()

# Limit what `from video.ws import *` exposes
__all__ = ["ws", "broadcast", "broadcast_bytes"]