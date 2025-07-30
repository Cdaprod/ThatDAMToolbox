#!/usr/bin/env python3
"""
/video/modules/explorer/routes.py

/explorer REST endpoints – auto-mounted by the core plug-in loader
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Body, Request
from fastapi.responses import RedirectResponse
from video.storage.base     import StorageEngine
from video.core             import get_manifest            # core.batch → manifest
from video.models           import CardResponse, VideoCard, SceneThumb
import logging
import time
from pathlib import Path

# --- Logging setup ----------------------------------------------------------
log = logging.getLogger("video.explorer")
log.setLevel(logging.INFO)          # DEBUG for extra verbosity during dev

router = APIRouter(prefix="/explorer", tags=["explorer"])


def _stamp(request: Request) -> str:
    """Return compact "METHOD /path" string for log lines."""
    return f"{request.method} {request.url.path}"


# --------------------------------------------------------------------------- #
# Dependency injection helper
# --------------------------------------------------------------------------- #
def _store() -> StorageEngine:        # keeps typing clean everywhere
    # Late-import avoids circular-import during bootstrap
    from video.bootstrap import STORAGE
    return STORAGE


# --------------------------------------------------------------------------- #
# Helpers – map DB rows / manifest → UI-friendly models
# --------------------------------------------------------------------------- #
def _rows_to_cards(rows: list[dict]) -> list[VideoCard]:
    """Rows come from StorageEngine.list_recent() – map → VideoCard"""
    return [VideoCard(artifact=r, scenes=[]) for r in rows]    # no thumbs for feed


def _manifest_to_cards(manifest) -> list[VideoCard]:
    cards: list[VideoCard] = []
    slice_map = manifest["slices"]        # keyed by sha1
    for art in manifest["artifacts"]:
        thumbs: list[SceneThumb] = []
        for sl in slice_map.get(art["sha1"], [])[:2]:          # first 2 L1 slices
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
async def list_recent(
    request: Request,
    limit: int = Query(50, le=500),
    store: StorageEngine = Depends(_store),
):
    """
    Returns the N most recently ingested VideoArtifacts (created DESC).
    """
    t0 = time.perf_counter()
    rows = store.list_recent(limit)
    elapsed = (time.perf_counter() - t0) * 1000
    log.info("%s → /explorer [limit=%d]: %d rows in %.1f ms",
             _stamp(request), limit, len(rows), elapsed)
    return CardResponse(batch_id="_recent", items=_rows_to_cards(rows))


# --------------------------------------------------------------------------- #
# 2) Batch detail  –  GET  /explorer/batch/{batch_id}
# --------------------------------------------------------------------------- #
@router.get(
    "/batch/{batch_id}",
    response_model=CardResponse,
    summary="Full manifest for one batch (→ cards)",
)
async def batch_detail(
    request: Request,
    batch_id: str,
    store: StorageEngine = Depends(_store),     # noqa: ARG001
):
    t0 = time.perf_counter()
    manifest = get_manifest(batch_id)
    if manifest is None:
        log.warning("%s → /explorer/batch/%s: batch not found",
                    _stamp(request), batch_id)
        raise HTTPException(404, "batch not found")

    elapsed = (time.perf_counter() - t0) * 1000
    num_arts   = len(manifest["artifacts"])
    num_slices = sum(len(v) for v in manifest["slices"].values())
    log.info("%s → /explorer/batch/%s: %d artifacts, %d slices in %.1f ms",
             _stamp(request), batch_id, num_arts, num_slices, elapsed)
    return CardResponse(batch_id=batch_id, items=_manifest_to_cards(manifest))


# --------------------------------------------------------------------------- #
# Legacy helper – keeps old links working
# --------------------------------------------------------------------------- #
@router.get("", include_in_schema=False)
async def redirect_root(limit: int = 50):
    """302 helper so '/explorer?limit=' → '/explorer/?limit=' still works"""
    return RedirectResponse(url=f"/api/v1/explorer/?limit={limit}")


# --------------------------------------------------------------------------- #
# Re-ordering / drag-and-drop  –  PATCH /explorer/{sha1}
# --------------------------------------------------------------------------- #
@router.patch("/{sha1}", status_code=204)
async def set_position(
    request: Request,
    sha1: str,
    position: int = Body(..., ge=0),
    store: StorageEngine = Depends(_store),
):
    """
    Persist new sort-order when the user drags cards around.
    For now just save it in the DB – extend as you like.
    """
    store.set_position(sha1, position)
    log.info("%s → /explorer/%s: reordered to position %d",
             _stamp(request), sha1, position)


# --------------------------------------------------------------------------- #
# NEW – folder list  GET /explorer/folders
# --------------------------------------------------------------------------- #
@router.get("/folders", summary="All folders (flat)")
async def list_folders(
    request: Request,
    store: StorageEngine = Depends(_store),
):
    """
    Returns every *distinct* folder that currently contains media.
    Shape expected by React:
        [{id, name, path, parent_id}, …]
    """
    t0 = time.perf_counter()
    rows = store.list_all_folders()
    elapsed = (time.perf_counter() - t0) * 1000
    log.info("%s → /explorer/folders: %d folders in %.1f ms",
             _stamp(request), len(rows), elapsed)
    return rows


# --------------------------------------------------------------------------- #
# NEW – assets in one folder  GET /explorer/assets?path=
# --------------------------------------------------------------------------- #
@router.get("/assets", summary="Assets directly under a folder")
async def list_assets(
    request: Request,
    path: str = Query(..., description="Folder path"),
    store: StorageEngine = Depends(_store),
):
    t0 = time.perf_counter()
    rows = store.list_assets(Path(path))
    elapsed = (time.perf_counter() - t0) * 1000
    log.info("%s → /explorer/assets?path=%s: %d assets in %.1f ms",
             _stamp(request), path, len(rows), elapsed)
    return _rows_to_cards(rows)