"""Batch management endpoints."""
from __future__ import annotations

import json
import logging
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException

from video.api.schemas import BatchUpsertRequest
from video.cli import run_cli_from_json
from video.helpers import index_folder_as_batch
from video.core import get_manifest as core_get_manifest
from video.models import CardResponse, SceneThumb, VideoCard

router = APIRouter(prefix="/batches", tags=["batches"])
log = logging.getLogger("video.api.batches")

_jobs: Dict[str, Dict[str, Any]] = {}


def _cli_json(cmd: dict[str, Any]) -> Any:
    return json.loads(run_cli_from_json(json.dumps(cmd)))


@router.get("/")
async def list_batches():
    return _cli_json({"action": "batches", "cmd": "list"})


@router.get("/{batch_name}")
async def get_batch(batch_name: str):
    return _cli_json({"action": "batches", "cmd": "show", "batch_name": batch_name})


@router.post("/", response_model=dict)
async def upsert_batch(req: BatchUpsertRequest, bg: BackgroundTasks):
    if req.folder:
        folder = Path(req.folder)
        if not folder.is_dir():
            raise HTTPException(400, f"{folder} is not a directory")
        batch_id = index_folder_as_batch(folder, batch_name=req.name)
        manifest = core_get_manifest(batch_id)
        if manifest is None:
            raise HTTPException(500, "batch processing failed")
        return manifest

    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "result": None}

    def _worker():
        try:
            batch_cmd = {
                "action": "batches",
                "cmd": "create",
                "name": req.name,
                "paths": req.paths,
            }
            result = run_cli_from_json(json.dumps(batch_cmd))
            _jobs[job_id] = {"status": "completed", "result": result}
        except Exception as e:  # pragma: no cover - background job
            log.exception("Batch create failed")
            _jobs[job_id] = {"status": "error", "result": {"error": str(e)}}

    bg.add_task(_worker)
    return {"job_id": job_id, "status": "started"}


@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return job


@router.delete("/{batch_name}")
async def delete_batch(batch_name: str):
    return _cli_json({"action": "batches", "cmd": "delete", "batch_name": batch_name})


@router.get("/{batch_id}/cards", response_model=CardResponse)
async def batch_cards(batch_id: str, limit: int = 50, include_score: bool = False):
    manifest = core_get_manifest(batch_id)
    if manifest is None:
        raise HTTPException(404, "batch not found")

    cards: list[VideoCard] = []
    for art in manifest.artifacts[:limit]:
        l1_slices = manifest.slices.get(art.sha1, [])
        thumbs: list[SceneThumb] = []
        for sl in l1_slices[:2]:
            thumb_url = f"/static/thumbs/{art.sha1}_{sl.start_time:.0f}.jpg"
            thumbs.append(SceneThumb(time=sl.start_time, url=thumb_url))

        score = None
        if include_score:
            score = None  # placeholder for future similarity lookup

        cards.append(VideoCard(artifact=art, scenes=thumbs, score=score))

    return CardResponse(batch_id=batch_id, items=cards)
