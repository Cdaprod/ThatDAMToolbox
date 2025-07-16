#!/usr/bin/env python3
"""
/explorer REST endpoints – auto-mounted by the core plug-in loader
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Body
from video.bootstrap        import STORAGE                 # AutoStorage singleton
from video.storage.base     import StorageEngine
from video.core             import get_manifest            # core.batch → manifest
from video.models           import CardResponse, VideoCard, SceneThumb

router = APIRouter(prefix="/explorer", tags=["explorer"])

# --------------------------------------------------------------------------- #
# Dependency injection helper
# --------------------------------------------------------------------------- #
def _store() -> StorageEngine:        # keeps typing clean everywhere
    return STORAGE

# --------------------------------------------------------------------------- #
# Helpers – turn raw DB rows / manifest into the UI-friendly VideoCard model
# --------------------------------------------------------------------------- #
def _rows_to_cards(rows: list[dict]) -> list[VideoCard]:
    """Rows come from StorageEngine.list_recent() – map → VideoCard"""
    cards: list[VideoCard] = []
    for r in rows:
        cards.append(VideoCard(artifact=r, scenes=[]))     # no thumbs for feed
    return cards


def _manifest_to_cards(manifest) -> list[VideoCard]:
    cards: list[VideoCard] = []
    slice_map = manifest["slices"]        # keyed by sha1
    for art in manifest["artifacts"]:
        thumbs: list[SceneThumb] = []
        for sl in slice_map.get(art["sha1"], [])[:2]:      # first 2 L1 slices
            thumbs.append(
                SceneThumb(
                    time=sl["start_time"],
                    url=f"/static/thumbs/{art['sha1']}_{int(sl['start_time'])}.jpg",
                )
            )
        cards.append(VideoCard(artifact=art, scenes=thumbs))
    return cards

# --------------------------------------------------------------------------- #
# 1) Recent feed  –  GET  /explorer?limit=…
# --------------------------------------------------------------------------- #
@router.get("/", response_model=CardResponse, summary="Recent media feed")
async def list_recent(limit: int = Query(50, le=500),
                      store: StorageEngine = Depends(_store)):
    """
    Returns the N most recently ingested VideoArtifacts (created DESC).
    """
    rows = store.list_recent(limit)            # already implemented in AutoStorage
    return CardResponse(batch_id="_recent", items=_rows_to_cards(rows))

# --------------------------------------------------------------------------- #
# 2) Batch detail  –  GET  /explorer/batch/{batch_id}
# --------------------------------------------------------------------------- #
@router.get("/batch/{batch_id}",
            response_model=CardResponse,
            summary="Full manifest for one batch (→ cards)")
async def batch_detail(batch_id: str,
                       store: StorageEngine = Depends(_store)):     # noqa: ARG001
    manifest = get_manifest(batch_id)
    if manifest is None:
        raise HTTPException(404, "batch not found")

    return CardResponse(batch_id=batch_id,
                        items=_manifest_to_cards(manifest))
                        
                        
@router.get("", include_in_schema=False)
async def redirect_root(limit: int = 50):
    """302 helper so '/explorer?limit=' → '/explorer/?limit=' still works"""
    return RedirectResponse(url=f"/api/v1/explorer/?limit={limit}")

# ── Re-ordering / drag-and-drop -------------------------------------------
@router.patch("/{sha1}", status_code=204)
async def set_position(sha1: str, position: int = Body(..., ge=0),
                       store: StorageEngine = Depends(_store)):
    """
    Persist new sort-order when the user drags cards around.
    For now just save it in the DB – extend as you like.
    """
    store.set_position(sha1, position)   # ⚠️ implement in AutoStorage