"""Endpoints that proxy CLI actions."""
from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, HTTPException

from video.api.schemas import CLIRequest
from video.cli import run_cli_from_json

router = APIRouter()
log = logging.getLogger("video.api.cli")


def _cli_json(cmd: dict[str, Any]) -> Any:
    return json.loads(run_cli_from_json(json.dumps(cmd)))


@router.post("/cli")
def cli_proxy(req: CLIRequest):
    """POST JSON {action:.., params:{...}} → run_cli_from_json()"""
    step = {"action": req.action, **req.params}
    try:
        return _cli_json(step)
    except Exception as e:  # pragma: no cover - pass through
        log.exception("CLI proxy failed")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def stats():
    return _cli_json({"action": "stats"})


@router.post("/search")
async def search(q: str, limit: int = 50):
    return _cli_json({"action": "search", "q": q, "limit": limit})


@router.post("/sync_album")
async def sync_album(album: str):
    return _cli_json({"action": "sync_album", "root": None, "album": album})


@router.post("/backup")
async def backup(source: str, destination: str | None = None):
    return _cli_json(
        {"action": "backup", "backup_root": destination or "/backup", "dry_run": False}
    )
