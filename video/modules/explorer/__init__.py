# video/modules/explorer/__init__.py
"""
Explorer plug-in.

Registers its on-disk data directories (thumb caches, search indexes, …)
so the core `video.api.modules.setup_module_static_mounts()` helper can mount
them automatically – exactly like hwcapture & dam.
"""

from video.config import register_module_paths, DATA_DIR

MODULE_PATH_DEFAULTS = {
    # directory → purpose → how the front-end will reach it
    "thumbs":   "thumbs",    # GET /modules/explorer/thumbs/…
    "cache":    "cache",     # cached manifests, pre-rendered JSON, …
    "exports":  "exports",   # user-initiated CSV/ZIP exports, etc.
}

register_module_paths(
    "explorer",
    {k: DATA_DIR / "modules" / "explorer" / v
     for k, v in MODULE_PATH_DEFAULTS.items()}
)

# REST routes
from .routes import router      # auto-mounted by core plug-in loader
from . import commands          # optional: registers CLI verb

__all__ = ["router"]