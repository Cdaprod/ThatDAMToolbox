#!/usr/bin/env python3
"""
/video/modules/dam/__init__.py

Digital Asset Management (DAM) plug-in module for the Video toolbox.

Adds:
• REST  – All DAM API routes under /dam
• (Optional) CLI – Any DAM-specific CLI verbs
• Exports all core singletons/services/entrypoints for re-use

Methodology: Consistent with hwcapture, explorer, etc.
"""

from video.config import register_module_paths, DATA_DIR

__version__ = "1.0.0"
__author__ = "DAM System"

from .main import app
from .commands import register_commands

# Declare all subdirs your module uses here:
MODULE_PATH_DEFAULTS = {
    "embeddings": "embeddings",       # For vector storage, Faiss, etc
    "manifests":  "manifests",        # For DAM-level manifest objects
    "previews":   "previews",         # For low-res or embedding previews
}
register_module_paths(
    "dam",
    {k: DATA_DIR / "modules" / "dam" / v for k, v in MODULE_PATH_DEFAULTS.items()}
)

# --- Side-effect imports: registers all REST endpoints and (optionally) CLI verbs ---
from . import routes      # FastAPI router (rest endpoints)
from . import commands    # If DAM needs CLI verbs, otherwise omit

# --- Export API: make DAM router and helpers discoverable by the loader ---
from .routes import router
# Export your key singletons/services, e.g. vector store
from .services import get_vector_store, get_embedding_generator, get_hierarchy_manager

__all__ = [
    "router",
    "get_vector_store",       # Example: for embedding search or upload
    "get_embedding_layer",    # Example: for downstream modules
]

# --- (Optional) Module init hook for global state setup ---
def init_module():
    from .services import init_services
    init_services()