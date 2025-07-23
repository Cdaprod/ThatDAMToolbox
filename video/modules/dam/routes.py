#!/usr/bin/env python3
"""
video/modules/dam/routes.py

FastAPI router for DAM-system endpoints (plug-in style).

Mount under `/dam` via:

    app.include_router(video.modules.dam.routes.router)

Exposed endpoints
─────────────────
POST  /dam/videos/ingest          – single-file ingest (L0 sync, L1-L3 async)
POST  /dam/videos/batch-ingest    – bulk ingest
POST  /dam/search                 – semantic search
GET   /dam/search/similar/{uuid}  – nearest-neighbour for one video
GET   /dam/videos/{uuid}          – metadata for one video
DELETE/dam/videos/{uuid}          – delete video + vectors
GET   /dam/videos                 – paginated list
POST  /dam/system/reindex         – re-embed all videos
GET   /dam/system/stats           – system statistics
GET   /dam/health                 – module health probe
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from .services import (
    get_embedding_generator,
    get_hierarchy_manager,
    get_vector_store,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/dam",
    tags=["dam"],
    responses={404: {"description": "Not found"}},
)

# ─────────────────────────────── Pydantic models ──────────────────────────────
class VideoIngestRequest(BaseModel):
    path: str
    metadata: Dict[str, Any] = {}
    force_reindex: bool = False


class SearchRequest(BaseModel):
    query: str
    level: str = "all"
    limit: int = 20
    threshold: float = 0.7


class VideoResponse(BaseModel):
    uuid: str
    path: str
    duration: float
    levels: Dict[str, int]
    metadata: Dict[str, Any]


class SearchResult(BaseModel):
    uuid: str
    path: str
    level: str
    start_time: float
    end_time: float
    score: float
    metadata: Dict[str, Any]


# ─────────────────────────────── Ingestion ────────────────────────────────────
@router.post("/videos/ingest", response_model=VideoResponse)
async def ingest_video(req: VideoIngestRequest, bg: BackgroundTasks):
    """
    • Generates an L0 vector immediately.  
    • Schedules L1–L3 extraction in the background.
    """
    hm = get_hierarchy_manager()
    eg = get_embedding_generator()
    vs = get_vector_store()

    # Short-circuit if we already have it
    existing = await hm.get_video_info(req.path)
    if existing and not req.force_reindex:
        logger.info("Video already indexed: %s", req.path)
        return VideoResponse(**existing)

    try:
        l0_vec = await eg.generate_video_vector(req.path)
        vid = await vs.store_video(req.path, l0_vec, req.metadata)

        # Kick off async levels
        bg.add_task(_process_levels, vid, req.path, req.metadata)

        return VideoResponse(
            uuid=vid,
            path=req.path,
            duration=await hm.get_video_duration(req.path),
            levels={"L0": 1, "L1": 0, "L2": 0, "L3": 0},
            metadata=req.metadata,
        )
    except FileNotFoundError:
        raise HTTPException(404, "File not found")
    except Exception as e:  # noqa: BLE001
        logger.exception("Ingest failed")
        raise HTTPException(500, str(e)) from e


@router.post("/videos/batch-ingest")
async def batch_ingest(paths: List[str], bg: BackgroundTasks):
    """Fire-and-forget batch ingest (returns a per-file status list)."""
    out: List[Dict[str, Any]] = []
    for p in paths:
        try:
            resp = await ingest_video(VideoIngestRequest(path=p), bg)
            out.append({"path": p, "status": "queued", "uuid": resp.uuid})
        except HTTPException as he:
            out.append({"path": p, "status": "error", "error": he.detail})
    return {"results": out}


# ─────────────────────────────── Search ───────────────────────────────────────
@router.post("/search", response_model=List[SearchResult])
async def search(req: SearchRequest):
    eg = get_embedding_generator()
    vs = get_vector_store()

    q_vec = await eg.generate_text_vector(req.query)
    hits = await vs.search_vectors(
        query_vector=q_vec,
        level=req.level,
        limit=req.limit,
        threshold=req.threshold,
    )
    return [
        SearchResult(
            uuid=h["uuid"],
            path=h["path"],
            level=h["level"],
            start_time=h["start_time"],
            end_time=h["end_time"],
            score=h["score"],
            metadata=h["metadata"],
        )
        for h in hits
    ]


@router.get("/search/similar/{video_uuid}")
async def similar_videos(video_uuid: str, level: str = "L1", limit: int = 10):
    vs = get_vector_store()

    base_vec = await vs.get_video_vector(video_uuid, level)
    if base_vec is None:
        raise HTTPException(404, "Video not found")

    hits = await vs.search_vectors(base_vec, level=level, limit=limit + 1)
    return {"similar_videos": [h for h in hits if h["uuid"] != video_uuid][:limit]}


# ─────────────────────────────── CRUD / management ────────────────────────────
@router.get("/videos/{video_uuid}", response_model=VideoResponse)
async def get_video(video_uuid: str):
    vs = get_vector_store()
    info = await vs.get_video_info(video_uuid)
    if not info:
        raise HTTPException(404, "Video not found")
    return VideoResponse(**info)


@router.delete("/videos/{video_uuid}")
async def delete_video(video_uuid: str):
    vs = get_vector_store()
    await vs.delete_video(video_uuid)
    return {"deleted": video_uuid}


@router.get("/videos")
async def list_videos(skip: int = 0, limit: int = 50, filter_by: Optional[str] = None):
    vs = get_vector_store()
    vids = await vs.list_videos(skip=skip, limit=limit, filter_by=filter_by)
    return {"videos": vids, "total": len(vids)}


# ─────────────────────────────── System ops ───────────────────────────────────
@router.post("/system/reindex")
async def reindex(bg: BackgroundTasks, embedding_version: str = "v2"):
    vs = get_vector_store()
    for v in await vs.list_videos():
        bg.add_task(_reindex_video, v["uuid"], v["path"], embedding_version)
    return {"status": "queued", "embedding_version": embedding_version}


@router.get("/system/stats")
async def system_stats():
    return await get_vector_store().get_system_stats()


@router.get("/health")
async def health():
    return {"status": "healthy", "vector_store": get_vector_store() is not None}


# ─────────────────────────────── Background helpers ───────────────────────────
async def _process_levels(uuid_: str, path: str, meta: Dict[str, Any]):
    hm = get_hierarchy_manager()
    eg = get_embedding_generator()
    vs = get_vector_store()

    try:
        scenes = await hm.detect_scenes(path)
        for lvl in ("L1", "L2", "L3"):
            vecs = await eg.generate_level_vectors(path, scenes, lvl)
            await vs.store_level_vectors(uuid_, lvl, vecs)
        logger.info("Completed L1–L3 for %s", path)
    except Exception as e:  # noqa: BLE001
        logger.exception("Async level extraction failed for %s", path)
        # We *do not* re-raise – background task should never kill the event loop.


# ─────────────────────────────── Background helpers ───────────────────────────
async def _reindex_video(uuid_: str, path: str, ver: str):
    """
    Re-compute **all** embeddings for one video and tag them with a new
    `embedding_version`.

    Strategy
    ────────
    1.  Purge every existing vector for that UUID (if the Vector-store exposes
        such a helper; otherwise fall back to `delete_video` → re-create).
    2.  Generate a fresh L0 embedding and overwrite it in the store.
    3.  Detect scenes and re-generate the L1-L3 slices.
    4.  Push everything back, adding `embedding_version=ver` to the metadata.

    The function is idempotent: running it twice yields the same end state.
    """
    vs = get_vector_store()
    eg = get_embedding_generator()
    hm = get_hierarchy_manager()

    try:
        # ── 1. Purge old vectors ───────────────────────────────────────────
        purge = getattr(vs, "purge_vectors", None) or getattr(vs, "delete_vectors", None)
        if purge:                       # happy path: store has a purge helper
            await purge(uuid_)
        else:                           # fall-back: drop and recreate the video row
            meta = await vs.get_video_info(uuid_) or {}
            await vs.delete_video(uuid_)
            # keep minimal placeholder so UUID remains valid until we re-fill
            await vs.store_video(path, [0.0], meta)

        # ── 2. Re-generate L0 ──────────────────────────────────────────────
        l0_vec = await eg.generate_video_vector(path, version=ver)
        update = (
            getattr(vs, "update_video_vector", None)
            or getattr(vs, "store_video_vector", None)
            or vs.store_video          # worst case: overwrite whole row
        )
        await update(uuid_, l0_vec, meta={"embedding_version": ver})

        # ── 3. Re-generate L1-L3 ───────────────────────────────────────────
        scenes = await hm.detect_scenes(path)
        for lvl in ("L1", "L2", "L3"):
            vecs = await eg.generate_level_vectors(path, scenes, lvl, version=ver)
            await vs.store_level_vectors(
                uuid_,
                lvl,
                vecs,
                metadata={"embedding_version": ver},
            )

        logger.info("✅  Re-indexed %s (uuid=%s) with embedding=%s", path, uuid_, ver)

    except FileNotFoundError:
        # Domain error → HTTP 410 (gone) if bubbled through an endpoint
        logger.warning("⛔  File vanished during re-index: %s", path)
    except Exception as exc:            # noqa: BLE001
        # Don’t re-raise – this is a background task
        logger.exception("❌  Re-index of %s failed: %s", path, exc)