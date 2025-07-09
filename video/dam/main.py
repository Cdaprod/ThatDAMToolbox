### video/dam/main.py
"""
Main FastAPI application for the video DAM system.
Integrates all components and provides the ASGI application instance.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
from typing import Dict, Any

from .router import router
from .commands import register_commands
from .models.hierarchy import HierarchyManager
from .models.embeddings import EmbeddingGenerator
from .models.storage import VectorStorage

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Global instances
hierarchy_manager = None
embedding_generator = None
vector_storage = None

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager for startup/shutdown."""
    global hierarchy_manager, embedding_generator, vector_storage
    
    logger.info("Starting DAM system...")
    
    # Initialize core components
    hierarchy_manager = HierarchyManager()
    embedding_generator = EmbeddingGenerator()
    vector_storage = VectorStorage()
    
    # Initialize storage connections
    await vector_storage.initialize()
    
    # Register CLI commands
    register_commands(app)
    
    logger.info("DAM system initialized successfully")
    
    yield
    
    # Cleanup
    logger.info("Shutting down DAM system...")
    if vector_storage:
        await vector_storage.close()

# Create FastAPI app
app = FastAPI(
    title="Video DAM System",
    description="Embedding-first Digital Asset Management for video content",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include router
app.include_router(router, prefix="/api/v1")

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "components": {
            "hierarchy_manager": hierarchy_manager is not None,
            "embedding_generator": embedding_generator is not None,
            "vector_storage": vector_storage is not None
        }
    }

# Global state access for other modules
def get_hierarchy_manager() -> HierarchyManager:
    """Get the global hierarchy manager instance."""
    if hierarchy_manager is None:
        raise HTTPException(status_code=500, detail="Hierarchy manager not initialized")
    return hierarchy_manager

def get_embedding_generator() -> EmbeddingGenerator:
    """Get the global embedding generator instance."""
    if embedding_generator is None:
        raise HTTPException(status_code=500, detail="Embedding generator not initialized")
    return embedding_generator

def get_vector_storage() -> VectorStorage:
    """Get the global vector storage instance."""
    if vector_storage is None:
        raise HTTPException(status_code=500, detail="Vector storage not initialized")
    return vector_storage