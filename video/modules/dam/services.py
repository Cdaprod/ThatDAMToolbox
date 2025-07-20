# /video/modules/dam/services.py

import logging
from typing import Optional
from fastapi import HTTPException

from .models.hierarchy   import HierarchyManager
from .models.embeddings  import EmbeddingGenerator
from .models.storage     import VectorStorage

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# Global singleton objects (initialized by init_module or on first use)
hierarchy_manager: Optional[HierarchyManager] = None
embedding_generator: Optional[EmbeddingGenerator] = None
vector_storage: Optional[VectorStorage] = None

def init_services():
    """Initialize all DAM services (called by init_module or app startup)."""
    global hierarchy_manager, embedding_generator, vector_storage
    if hierarchy_manager is None:
        hierarchy_manager = HierarchyManager()
    if embedding_generator is None:
        embedding_generator = EmbeddingGenerator()
    if vector_storage is None:
        vector_storage = VectorStorage()

async def initialize_vector_storage():
    """Async setup for vector storage (if needed)."""
    if vector_storage is not None:
        await vector_storage.initialize()

def get_hierarchy_manager() -> HierarchyManager:
    if hierarchy_manager is None:
        raise HTTPException(500, "Hierarchy manager not initialised")
    return hierarchy_manager

def get_embedding_generator() -> EmbeddingGenerator:
    if embedding_generator is None:
        raise HTTPException(500, "Embedding generator not initialised")
    return embedding_generator

def get_vector_store() -> VectorStorage:
    if vector_storage is None:
        raise HTTPException(500, "Vector storage not initialised")
    return vector_storage

__all__ = [
    "get_hierarchy_manager",
    "get_embedding_generator",
    "get_vector_store",
    "init_services",
    "initialize_vector_storage"
]