"""Media retrieval endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from video.storage.base import StorageEngine
from video.models import Manifest
from video.bootstrap import STORAGE

router = APIRouter()


def get_store() -> StorageEngine:
    return STORAGE


@router.get("/media/{sha1}", response_model=Manifest)
async def fetch_manifest(sha1: str, store: StorageEngine = Depends(get_store)):
    manifest = store.get_video(sha1)
    if manifest is None:
        raise HTTPException(status_code=404, detail="media not found")
    return manifest
