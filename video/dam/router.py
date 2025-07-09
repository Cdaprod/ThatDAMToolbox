### video/dam/router.py
"""
FastAPI router for DAM system endpoints.
Handles video ingestion, search, and management operations.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import logging
import asyncio
from pathlib import Path

from .main import get_hierarchy_manager, get_embedding_generator, get_vector_storage

logger = logging.getLogger(__name__)

router = APIRouter()

# Request/Response models
class VideoIngestRequest(BaseModel):
    """Request model for video ingestion."""
    path: str
    metadata: Dict[str, Any] = {}
    force_reindex: bool = False

class SearchRequest(BaseModel):
    """Request model for semantic search."""
    query: str
    level: str = "all"  # L0, L1, L2, L3, or "all"
    limit: int = 20
    threshold: float = 0.7

class VideoResponse(BaseModel):
    """Response model for video operations."""
    uuid: str
    path: str
    duration: float
    levels: Dict[str, int]  # level -> count of vectors
    metadata: Dict[str, Any]

class SearchResult(BaseModel):
    """Search result model."""
    uuid: str
    path: str
    level: str
    start_time: float
    end_time: float
    score: float
    metadata: Dict[str, Any]

# Video ingestion endpoints
@router.post("/videos/ingest", response_model=VideoResponse)
async def ingest_video(
    request: VideoIngestRequest,
    background_tasks: BackgroundTasks
):
    """
    Ingest a video file and generate embeddings.
    
    - Generates L0 vector immediately for deduplication
    - Queues async job for L1-L3 vector generation
    """
    try:
        hierarchy_manager = get_hierarchy_manager()
        embedding_generator = get_embedding_generator()
        vector_storage = get_vector_storage()
        
        # Check if video already exists
        video_info = await hierarchy_manager.get_video_info(request.path)
        if video_info and not request.force_reindex:
            logger.info(f"Video already indexed: {request.path}")
            return VideoResponse(**video_info)
        
        # Generate L0 vector immediately
        logger.info(f"Generating L0 vector for: {request.path}")
        l0_vector = await embedding_generator.generate_video_vector(request.path)
        
        # Store initial video record
        video_uuid = await vector_storage.store_video(
            path=request.path,
            l0_vector=l0_vector,
            metadata=request.metadata
        )
        
        # Queue async processing for L1-L3 levels
        background_tasks.add_task(
            process_video_levels,
            video_uuid,
            request.path,
            request.metadata
        )
        
        return VideoResponse(
            uuid=video_uuid,
            path=request.path,
            duration=await hierarchy_manager.get_video_duration(request.path),
            levels={"L0": 1, "L1": 0, "L2": 0, "L3": 0},
            metadata=request.metadata
        )
        
    except Exception as e:
        logger.error(f"Error ingesting video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/videos/batch-ingest")
async def batch_ingest_videos(
    paths: List[str],
    background_tasks: BackgroundTasks
):
    """Batch ingest multiple videos."""
    results = []
    
    for path in paths:
        try:
            request = VideoIngestRequest(path=path)
            result = await ingest_video(request, background_tasks)
            results.append({"path": path, "status": "queued", "uuid": result.uuid})
        except Exception as e:
            results.append({"path": path, "status": "error", "error": str(e)})
    
    return {"results": results}

# Search endpoints
@router.post("/search", response_model=List[SearchResult])
async def search_videos(request: SearchRequest):
    """
    Semantic search across video embeddings.
    
    Supports natural language queries like "slow-mo soldering iron spark"
    """
    try:
        vector_storage = get_vector_storage()
        embedding_generator = get_embedding_generator()
        
        # Generate query embedding
        query_vector = await embedding_generator.generate_text_vector(request.query)
        
        # Search across specified levels
        results = await vector_storage.search_vectors(
            query_vector=query_vector,
            level=request.level,
            limit=request.limit,
            threshold=request.threshold
        )
        
        return [
            SearchResult(
                uuid=result["uuid"],
                path=result["path"],
                level=result["level"],
                start_time=result["start_time"],
                end_time=result["end_time"],
                score=result["score"],
                metadata=result["metadata"]
            )
            for result in results
        ]
        
    except Exception as e:
        logger.error(f"Error searching videos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/search/similar/{video_uuid}")
async def find_similar_videos(
    video_uuid: str,
    level: str = "L1",
    limit: int = 10
):
    """Find videos similar to a given video."""
    try:
        vector_storage = get_vector_storage()
        
        # Get video's embedding
        video_vector = await vector_storage.get_video_vector(video_uuid, level)
        if not video_vector:
            raise HTTPException(status_code=404, detail="Video not found")
        
        # Search for similar vectors
        results = await vector_storage.search_vectors(
            query_vector=video_vector,
            level=level,
            limit=limit + 1  # +1 to exclude self
        )
        
        # Filter out the original video
        filtered_results = [r for r in results if r["uuid"] != video_uuid][:limit]
        
        return {"similar_videos": filtered_results}
        
    except Exception as e:
        logger.error(f"Error finding similar videos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Video management endpoints
@router.get("/videos/{video_uuid}", response_model=VideoResponse)
async def get_video_info(video_uuid: str):
    """Get detailed information about a video."""
    try:
        hierarchy_manager = get_hierarchy_manager()
        vector_storage = get_vector_storage()
        
        video_info = await vector_storage.get_video_info(video_uuid)
        if not video_info:
            raise HTTPException(status_code=404, detail="Video not found")
        
        return VideoResponse(**video_info)
        
    except Exception as e:
        logger.error(f"Error getting video info: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/videos/{video_uuid}")
async def delete_video(video_uuid: str):
    """Delete a video and all its embeddings."""
    try:
        vector_storage = get_vector_storage()
        
        await vector_storage.delete_video(video_uuid)
        
        return {"message": f"Video {video_uuid} deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting video: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/videos")
async def list_videos(
    skip: int = 0,
    limit: int = 50,
    filter_by: Optional[str] = None
):
    """List all videos with pagination."""
    try:
        vector_storage = get_vector_storage()
        
        videos = await vector_storage.list_videos(
            skip=skip,
            limit=limit,
            filter_by=filter_by
        )
        
        return {"videos": videos, "total": len(videos)}
        
    except Exception as e:
        logger.error(f"Error listing videos: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# System management endpoints
@router.post("/system/reindex")
async def reindex_videos(
    background_tasks: BackgroundTasks,
    embedding_version: str = "v2"
):
    """Trigger system-wide reindexing with new embedding version."""
    try:
        vector_storage = get_vector_storage()
        
        # Get all videos
        videos = await vector_storage.list_videos()
        
        # Queue reindexing for each video
        for video in videos:
            background_tasks.add_task(
                reindex_video,
                video["uuid"],
                video["path"],
                embedding_version
            )
        
        return {
            "message": f"Reindexing {len(videos)} videos",
            "embedding_version": embedding_version
        }
        
    except Exception as e:
        logger.error(f"Error triggering reindex: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/system/stats")
async def get_system_stats():
    """Get system statistics."""
    try:
        vector_storage = get_vector_storage()
        
        stats = await vector_storage.get_system_stats()
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting system stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# Background task functions
async def process_video_levels(video_uuid: str, path: str, metadata: Dict[str, Any]):
    """Background task to process L1-L3 levels for a video."""
    try:
        hierarchy_manager = get_hierarchy_manager()
        embedding_generator = get_embedding_generator()
        vector_storage = get_vector_storage()
        
        logger.info(f"Processing L1-L3 levels for: {path}")
        
        # Detect scenes (L1)
        scenes = await hierarchy_manager.detect_scenes(path)
        logger.info(f"Detected {len(scenes)} scenes")
        
        # Generate embeddings for each level
        for level in ["L1", "L2", "L3"]:
            vectors = await embedding_generator.generate_level_vectors(
                path, scenes, level
            )
            
            await vector_storage.store_level_vectors(
                video_uuid, level, vectors
            )
            
            logger.info(f"Stored {len(vectors)} {level} vectors")
        
        logger.info(f"Completed processing all levels for: {path}")
        
    except Exception as e:
        logger.error(f"Error processing video levels: {str(e)}")

async def reindex_video(video_uuid: str, path: str, embedding_version: str):
    """Background task to reindex a single video."""
    try:
        logger.info(f"Reindexing video: {path} with version {embedding_version}")
        
        # Implementation would regenerate all embeddings with new version
        # This is a placeholder for the actual reindexing logic
        
        logger.info(f"Completed reindexing: {path}")
        
    except Exception as e:
        logger.error(f"Error reindexing video: {str(e)}")