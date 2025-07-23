#!/usr/bin/env python3
"""
/video/modules/dam/__init__.py

Digital Asset Management (DAM) plug-in module for the Video toolbox.

Adds:
• REST  – All DAM API routes under /dam
• CLI   – `video dam …` via std-lib argparse
• Exports core singletons/services/entrypoints for re-use
"""

from video.config import register_module_paths, DATA_DIR

__version__ = "1.0.0"
__author__ = "DAM System"

# Declare and register all module data sub-directories
MODULE_PATH_DEFAULTS = {
    "embeddings": "embeddings",       # For vector storage, Faiss, etc
    "manifests":  "manifests",        # For DAM-level manifest objects
    "previews":   "previews",         # For low-res or embedding previews
}
register_module_paths(
    "dam",
    {k: DATA_DIR / "modules" / "dam" / v for k, v in MODULE_PATH_DEFAULTS.items()}
)

# REST routes
from .routes import router

# CLI hook: your argparse CLI loader will import this module’s
# commands.py (which defines `add_parser`)
from . import commands  # side-effect: defines commands.add_parser()

# Core service singletons
from .services import (
    get_vector_store,
    get_embedding_generator,
    get_hierarchy_manager,
)

__all__ = [
    "router",
    "get_vector_store",
    "get_embedding_generator",
    "get_hierarchy_manager",
]

def init_module():
    """
    Called by the application at startup to initialize DAM services.
    """
    from .services import init_services
    init_services()

# ---------------------------------------------------------------------------
# Eager bootstrap (optional)
# ---------------------------------------------------------------------------
try:
    init_module()           # spin up Vector-store etc. right away
except Exception as exc:    # noqa: BLE001
    import logging
    logging.getLogger("video.dam").warning(
        "DAM services failed to initialise eagerly – will retry on demand.  %s",
        exc,
    )