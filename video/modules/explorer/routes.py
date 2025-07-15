# video/modules/explorer/routes.py
from fastapi import APIRouter, Depends, HTTPException, Query
from video.bootstrap import STORAGE          # your AutoStorage singleton
from video.core      import get_manifest
from video.storage.base import StorageEngine

router = APIRouter(prefix="/explorer", tags=["explorer"])

# --- DI helper --------------------------------------------------------------
def _store() -> StorageEngine:
    return STORAGE

# --------------------------------------------------------------------------- #
# 1) Home / recent feed  –  GET /explorer?limit=50
# --------------------------------------------------------------------------- #
@router.get("/", summary="Recent video artifacts")
async def list_recent(limit: int = Query(50, le=500),
                      store: StorageEngine = Depends(_store)):
    """
    Returns the N most recently ingested VideoArtifacts ordered by created desc.
    The SPA loads this for the “home / explorer” grid.
    """
    rows = store.list_recent(limit)          # already available in AutoStorage
    return {"items": rows}

# --------------------------------------------------------------------------- #
# 2) Batch detail  –  GET /explorer/batch/{batch_id}
# --------------------------------------------------------------------------- #
@router.get("/batch/{batch_id}", summary="Full manifest for one batch")
async def batch_detail(batch_id: str,
                       store: StorageEngine = Depends(_store)):
    manifest = get_manifest(batch_id)
    if manifest is None:
        raise HTTPException(404, "batch not found")
    return manifest