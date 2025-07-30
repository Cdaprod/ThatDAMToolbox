#!/usr/bin/env python3
"""
video.modules.uploader
──────────────────────
REST & CLI entry-point for "upload".

The *staging* directory is whatever you configured as
[paths] web_uploads in *video.cfg* (defaults to
/data/_INCOMING/sources/WEB_UPLOADS).
"""

from __future__ import annotations

import logging
from importlib import import_module

from video.config import WEB_UPLOADS, register_module_paths

log = logging.getLogger("video.uploader")

# ─────────────────────────────── paths ──────────────────────────────
# Make the staging dir discoverable via video.config.get_module_path()
register_module_paths("uploader", {"staging": WEB_UPLOADS})

# Ensure it exists and is writable (should already be, but be safe)
WEB_UPLOADS.mkdir(parents=True, exist_ok=True)
log.info("Uploader staging dir: %s", WEB_UPLOADS)

# ────────────────────────────── REST API ────────────────────────────
# Import *after* the path is registered so the router can reference it
router = import_module(".routes", __name__).router

# ─────────────────────────────── CLI hook ───────────────────────────
try:
    import_module(".commands", __name__)       # formerly cli.py
    log.debug("Uploader CLI verb registered")
except ImportError:
    log.debug("Uploader CLI verb not loaded (optional deps missing)")

__all__: list[str] = ["router"]