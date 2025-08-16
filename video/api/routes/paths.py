"""Endpoints for managing scan paths."""
from __future__ import annotations

from fastapi import APIRouter
import json

from video.cli import run_cli_from_json

router = APIRouter(prefix="/paths", tags=["paths"])


def _cli_json(cmd: dict) -> dict:
    return json.loads(run_cli_from_json(json.dumps(cmd)))


@router.get("/")
async def list_paths():
    return _cli_json({"action": "paths", "cmd": "list"})


@router.post("/")
async def add_path(name: str, path: str):
    return _cli_json({"action": "paths", "cmd": "add", "name": name, "path": path})


@router.delete("/{name}")
async def remove_path(name: str):
    return _cli_json({"action": "paths", "cmd": "remove", "name": name})
