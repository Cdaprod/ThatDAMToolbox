#!/usr/bin/env python3
"""
video/modules/dam/routes.py
FastAPI router for DAM system endpoints (plugin style).
Handles video ingestion, search, management.
Mount under `/dam` via `app.include_router(router, prefix="/dam")`.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging

from .services import (
    get_hierarchy_manager,
    get_embedding_generator,
    get_vector_store,  # renamed for consistency
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/dam",
    tags=["dam"],
    responses={404: {"description": "Not found"}}
)

# ------------------ Models ------------------

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

# ------------------ Ingestion ------------------

@router.post("/videos/ingest", response_model=VideoResponse)
async def ingest_video(request: VideoIngestRequest, background_tasks: BackgroundTasks):
    """
    Ingest a video file and generate L0 embedding immediately,
    schedule background for L1-L3.
    """
    try:
        hm = get_hierarchy_manager()
        eg = get_embedding_generator()
        vs = get_vector_store()

        # Check if exists
        video_info = await hm.get_video_info(request.path)
        if video_info and not request.force_reindex:
            logger.info(f"Video already indexed: {request.path}")
            return VideoResponse(**video_info)

        # Generate L0 immediately
        logger.info(f"Generating L0 for: {request.path}")
        l0_vector = await eg.generate_video_vector(request.path)
        video_uuid = await vs.store_video(request.path, l0_vector, request.metadata)

        # Queue L1-L3 in background
        background_tasks.add_task(
            process_video_levels, video_uuid, request.path, request.metadata
        )

        return VideoResponse(
            uuid=video_uuid,
            path=request.path,
            duration=await hm.get_video_duration(request.path),
            levels={"L0": 1, "L1": 0, "L2": 0, "L3": 0},
            metadata=request.metadata
        )
    except Exception as e:
        logger.exception("Error ingesting video")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/videos/batch-ingest")
async def batch_ingest_videos(
    paths: List[str],
    background_tasks: BackgroundTasks
):
    """Batch ingest multiple videos (returns result list)."""
    results = []
    for path in paths:
        try:
            req = VideoIngestRequest(path=path)
            res = await ingest_video(req, background_tasks)
            results.append({"path": path, "status": "queued", "uuid": res.uuid})
        except Exception as e:
            results.append({"path": path, "status": "error", "error": str(e)})
    return {"results": results}

# ------------------ Search ------------------

@router.post("/search", response_model=List[SearchResult])
async def search_videos(request: SearchRequest):
    """
    Semantic search across video embeddings.
    """
    try:
        vs = get_vector_store()
        eg = get_embedding_generator()
        query_vector = await eg.generate_text_vector(request.query)
        results = await vs.search_vectors(
            query_vector=query_vector,
            level=request.level,
            limit=request.limit,
            threshold=request.threshold
        )
        return [
            SearchResult(
                uuid=x["uuid"], path=x["path"], level=x["level"],
                start_time=x["start_time"], end_time=x["end_time"],
                score=x["score"], metadata=x["metadata"]
            )
            for x in results
        ]
    except Exception as e:
        logger.exception("Error searching videos")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/search/similar/{video_uuid}")
async def find_similar_videos(video_uuid: str, level: str = "L1", limit: int = 10):
    """
    Find videos similar to a given one, by UUID.
    """
    try:
        vs = get_vector_store()
        video_vector = await vs.get_video_vector(video_uuid, level)
        if not video_vector:
            raise HTTPException(404, "Video not found")
        results = await vs.search_vectors(query_vector=video_vector, level=level, limit=limit+1)
        filtered = [x for x in results if x["uuid"] != video_uuid][:limit]
        return {"similar_videos": filtered}
    except Exception as e:
        logger.exception("Error finding similar videos")
        raise HTTPException(500, detail=str(e))

# ------------------ Management ------------------

@router.get("/videos/{video_uuid}", response_model=VideoResponse)
async def get_video_info(video_uuid: str):
    try:
        hm = get_hierarchy_manager()
        vs = get_vector_store()
        video_info = await vs.get_video_info(video_uuid)
        if not video_info:
            raise HTTPException(404, "Video not found")
        return VideoResponse(**video_info)
    except Exception as e:
        logger.exception("Error getting video info")
        raise HTTPException(500, detail=str(e))

@router.delete("/videos/{video_uuid}")
async def delete_video(video_uuid: str):
    try:
        vs = get_vector_store()
        await vs.delete_video(video_uuid)
        return {"message": f"Video {video_uuid} deleted"}
    except Exception as e:
        logger.exception("Error deleting video")
        raise HTTPException(500, detail=str(e))

@router.get("/videos")
async def list_videos(skip: int = 0, limit: int = 50, filter_by: Optional[str] = None):
    try:
        vs = get_vector_store()
        videos = await vs.list_videos(skip=skip, limit=limit, filter_by=filter_by)
        return {"videos": videos, "total": len(videos)}
    except Exception as e:
        logger.exception("Error listing videos")
        raise HTTPException(500, detail=str(e))

# ------------------ System ------------------

@router.post("/system/reindex")
async def reindex_videos(
    background_tasks: BackgroundTasks,
    embedding_version: str = "v2"
):
    try:
        vs = get_vector_store()
        videos = await vs.list_videos()
        for video in videos:
            background_tasks.add_task(
                reindex_video, video["uuid"], video["path"], embedding_version
            )
        return {
            "message": f"Reindexing {len(videos)} videos",
            "embedding_version": embedding_version
        }
    except Exception as e:
        logger.exception("Error triggering reindex")
        raise HTTPException(500, detail=str(e))

@router.get("/system/stats")
async def get_system_stats():
    try:
        vs = get_vector_store()
        return await vs.get_system_stats()
    except Exception as e:
        logger.exception("Error getting system stats")
        raise HTTPException(500, detail=str(e))

@router.get("/health")
async def health():
    """Health check for the DAM module."""
    try:
        vs = get_vector_store()
        return {"status": "healthy", "vector_store": vs is not None}
    except Exception as e:
        logger.exception("Health check failed")
        raise HTTPException(500, detail=str(e))

# ------------------ Background Tasks ------------------

async def process_video_levels(video_uuid: str, path: str, metadata: Dict[str, Any]):
    """Background processing for L1-L3."""
    try:
        hm = get_hierarchy_manager()
        eg = get_embedding_generator()
        vs = get_vector_store()
        logger.info(f"Processing L1-L3 for {path}")
        scenes = await hm.detect_scenes(path)
        logger.info(f"Detected {len(scenes)} scenes")
        for level in ["L1", "L2", "L3"]:
            vectors = await eg.generate_level_vectors(path, scenes, level)
            await vs.store_level_vectors(video_uuid, level, vectors)
            logger.info(f"Stored {len(vectors)} {level} vectors")
        logger.info(f"Completed levels for: {path}")
    except Exception as e:
        logger.exception("Error in process_video_levels")

async def reindex_video(video_uuid: str, path: str, embedding_version: str):
    try:
        logger.info(f"Reindexing {path} with embedding version {embedding_version}")
        # Insert reindexing logic here
        logger.info(f"Completed reindex for {path}")
    except Exception as e:
        logger.exception("Error in reindex_video")