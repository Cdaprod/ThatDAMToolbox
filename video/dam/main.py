"""
Main FastAPI application for the video DAM system.
Integrates all components and provides the ASGI application instance.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .commands import register_commands
from .models.hierarchy   import HierarchyManager
from .models.embeddings  import EmbeddingGenerator
from .models.storage     import VectorStorage

# ────────────────────────── logging ────────────────────────────
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ────────────────────────── globals ────────────────────────────
hierarchy_manager: Optional[HierarchyManager]   = None
embedding_generator: Optional[EmbeddingGenerator] = None
vector_storage:     Optional[VectorStorage]       = None

# ───────────────────────── lifespan ────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):  # noqa: D401
    """Start-up and shutdown resource management."""
    global hierarchy_manager, embedding_generator, vector_storage

    logger.info("🚀  Initialising DAM system …")
    hierarchy_manager   = HierarchyManager()
    embedding_generator = EmbeddingGenerator()
    vector_storage      = VectorStorage()

    await vector_storage.initialize()
    register_commands(app)

    logger.info("✅  DAM system ready")
    yield

    logger.info("⏹  Shutting down DAM system …")
    if vector_storage:
        await vector_storage.close()

# ────────────────────── FastAPI application ─────────────────────
app = FastAPI(
    title="Video DAM System",
    description="Embedding-first Digital Asset Management for video content",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"],
)

# ───────────────────── helper accessors (used by router) ────────
def get_hierarchy_manager() -> HierarchyManager:
    if hierarchy_manager is None:
        raise HTTPException(500, "Hierarchy manager not initialised")
    return hierarchy_manager

def get_embedding_generator() -> EmbeddingGenerator:
    if embedding_generator is None:
        raise HTTPException(500, "Embedding generator not initialised")
    return embedding_generator

def get_vector_storage() -> VectorStorage:
    if vector_storage is None:
        raise HTTPException(500, "Vector storage not initialised")
    return vector_storage

# ────────────────────── import router *after* accessors exist ──
from .router import router  # noqa: E402  (late import breaks circular-dep)

app.include_router(router, prefix="/api/v1")

# ────────────────────── health check ───────────────────────────
@app.get("/health")
async def health_check():
    return {
        "status":   "healthy",
        "version":  app.version,
        "components": {
            "hierarchy_manager":   hierarchy_manager   is not None,
            "embedding_generator": embedding_generator is not None,
            "vector_storage":      vector_storage      is not None,
        },
    }

__all__ = [
    "app",
    "get_hierarchy_manager",
    "get_embedding_generator",
    "get_vector_storage",
]