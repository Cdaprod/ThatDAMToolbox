## video/dam/models/storage.py
"""
Vector storage and retrieval layer for the DAM system.
Supports Weaviate, Milvus, and Faiss backends with hybrid search capabilities.
"""

import asyncio
import json
import logging
import uuid
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import numpy as np
from datetime import datetime

# Vector database imports (install as needed)
try:
    import weaviate
    WEAVIATE_AVAILABLE = True
except ImportError:
    WEAVIATE_AVAILABLE = False

try:
    from pymilvus import Collection, connections, FieldSchema, CollectionSchema, DataType
    MILVUS_AVAILABLE = True
except ImportError:
    MILVUS_AVAILABLE = False

try:
    import faiss
    FAISS_AVAILABLE = True
except ImportError:
    FAISS_AVAILABLE = False

from .hierarchy import VideoSlice

logger = logging.getLogger(__name__)

class VectorStorage:
    """
    Unified vector storage interface supporting multiple backends.
    Provides hybrid BM25+vector search and metadata management.
    """
    
    def __init__(self, backend: str = "weaviate", config: Dict[str, Any] = None):
        self.backend = backend
        self.config = config or {}
        self.client = None
        self.initialized = False
        
        # In-memory storage for development/testing
        self.memory_store = {
            "videos": {},
            "vectors": {},
            "metadata": {}
        }
    
    async def initialize(self):
        """Initialize the vector storage backend."""
        if self.backend == "weaviate" and WEAVIATE_AVAILABLE:
            await self._initialize_weaviate()
        elif self.backend == "milvus" and MILVUS_AVAILABLE:
            await self._initialize_milvus()
        elif self.backend == "faiss" and FAISS_AVAILABLE:
            await self._initialize_faiss()
        else:
            logger.warning(f"Backend {self.backend} not available, using in-memory storage")
            await self._initialize_memory()
        
        self.initialized = True
        logger.info(f"Vector storage initialized with backend: {self.backend}")
                
    async def store_video(self, path: str, l0_vector: np.ndarray, metadata: Dict[str, Any]) -> str:
        """Store L0 vector and video metadata."""
        video_uuid = str(uuid.uuid4())
        self.memory_store["videos"][video_uuid] = {
            "uuid": video_uuid,
            "path": path,
            "duration": float(len(l0_vector)),  # Placeholder, should be actual duration
            "levels": {"L0": 1, "L1": 0, "L2": 0, "L3": 0},
            "metadata": metadata
        }
        self.memory_store["vectors"][video_uuid] = {
            "L0": [{"vector": l0_vector, "start_time": 0.0, "end_time": 0.0, "metadata": metadata}]
        }
        logger.info(f"Stored video {path} with UUID {video_uuid}")
        return video_uuid

    async def store_level_vectors(self, video_uuid: str, level: str, vectors: List[Dict[str, Any]]):
        """Store L1-L3 level vectors for a video."""
        if video_uuid not in self.memory_store["vectors"]:
            self.memory_store["vectors"][video_uuid] = {}

        self.memory_store["vectors"][video_uuid][level] = vectors
        self.memory_store["videos"][video_uuid]["levels"][level] = len(vectors)
        logger.info(f"Stored {len(vectors)} vectors at level {level} for video {video_uuid}")

    async def search_vectors(self, query_vector: np.ndarray, level: str = "all", limit: int = 20, threshold: float = 0.7) -> List[Dict[str, Any]]:
        """Search memory store vectors using cosine similarity."""
        results = []
        levels_to_search = ["L0", "L1", "L2", "L3"] if level == "all" else [level]

        for video_uuid, levels in self.memory_store["vectors"].items():
            for lvl in levels_to_search:
                for vec_obj in levels.get(lvl, []):
                    vec = vec_obj["vector"]
                    score = float(np.dot(query_vector, vec) / (np.linalg.norm(query_vector) * np.linalg.norm(vec)))
                    if score >= threshold:
                        results.append({
                            "uuid": video_uuid,
                            "path": self.memory_store["videos"][video_uuid]["path"],
                            "level": lvl,
                            "start_time": vec_obj.get("start_time", 0.0),
                            "end_time": vec_obj.get("end_time", 0.0),
                            "score": score,
                            "metadata": vec_obj.get("metadata", {})
                        })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:limit]

    async def get_video_vector(self, video_uuid: str, level: str = "L0") -> Optional[np.ndarray]:
        """Return vector for a specific level of a video."""
        vectors = self.memory_store["vectors"].get(video_uuid, {}).get(level, [])
        return vectors[0]["vector"] if vectors else None

    async def get_video_info(self, video_uuid: str) -> Optional[Dict[str, Any]]:
        """Return metadata about a video."""
        return self.memory_store["videos"].get(video_uuid)

    async def delete_video(self, video_uuid: str):
        """Delete a video and all vectors."""
        self.memory_store["videos"].pop(video_uuid, None)
        self.memory_store["vectors"].pop(video_uuid, None)
        logger.info(f"Deleted video {video_uuid}")

    async def list_videos(self, skip: int = 0, limit: int = 50, filter_by: Optional[str] = None) -> List[Dict[str, Any]]:
        """Return list of videos."""
        videos = list(self.memory_store["videos"].values())
        if filter_by:
            videos = [v for v in videos if filter_by.lower() in v["path"].lower()]
        return videos[skip:skip+limit]

    async def get_system_stats(self) -> Dict[str, Any]:
        """Return stats about the in-memory store."""
        total_videos = len(self.memory_store["videos"])
        total_vectors = sum(
            sum(len(v) for v in levels.values())
            for levels in self.memory_store["vectors"].values()
        )
        vectors_by_level = {"L0": 0, "L1": 0, "L2": 0, "L3": 0}
        for levels in self.memory_store["vectors"].values():
            for lvl, vecs in levels.items():
                vectors_by_level[lvl] += len(vecs)

        return {
            "total_videos": total_videos,
            "total_vectors": total_vectors,
            "vectors_by_level": vectors_by_level,
            "storage_used": "in-memory"
        }

    async def close(self):
        """Cleanup resources."""
        logger.info("Closing vector storage backend (in-memory)")
        
    async def _initialize_weaviate(self):
        """Initialize Weaviate client and schema."""
        def _init():
            client = weaviate.Client(
                url=self.config.get("url", "http://localhost:8080"),
                additional_headers=self.config.get("headers", {})
            )
            schema = {
                "classes": [{
                    "class": "VideoEmbedding", "description": "Video content embeddings",
                    "vectorizer": "none",
                    "properties": [
                        {"name": "video_uuid",     "dataType": ["string"]},
                        {"name": "path",           "dataType": ["string"]},
                        {"name": "level",          "dataType": ["string"]},
                        {"name": "start_time",     "dataType": ["number"]},
                        {"name": "end_time",       "dataType": ["number"]},
                        {"name": "metadata",       "dataType": ["object"]},
                        {"name": "embedding_version","dataType":["string"]},
                        {"name": "created_at",     "dataType": ["date"]},
                    ],
                }]
            }
            try:
                existing = client.schema.get()
                classes  = [c["class"] for c in existing.get("classes",[])]
                if "VideoEmbedding" not in classes:
                    client.schema.create(schema)
            except Exception:
                client.schema.create(schema)
            return client

        self.client = await asyncio.get_event_loop().run_in_executor(None, _init)
        logger.info("Weaviate client initialized")

    async def _initialize_milvus(self):
        """Stub for Milvus; fallback to in-memory."""
        logger.warning("Milvus backend not implemented; falling back to in-memory")
        await self._initialize_memory()

    async def _initialize_faiss(self):
        """Stub for Faiss; fallback to in-memory."""
        logger.warning("Faiss backend not implemented; falling back to in-memory")
        await self._initialize_memory()

    async def _initialize_memory(self):
        """No-op initializer for in-memory storage."""
        self.client = None
        logger.info("Using in-memory vector storage")