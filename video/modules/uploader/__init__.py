#!/usr/bin/env python3
"""
Uploader plug-in – accepts multipart file uploads and drops the payloads
into the global WEB_UPLOADS staging directory, then hands them off to the
core ingest pipeline.

Adds
• REST  – POST /api/v1/upload/…   (routes.py)
• CLI   – `video upload …`        (commands.py)
"""

from __future__ import annotations
from importlib import import_module
import logging

from video.config import WEB_UPLOADS, register_module_paths

log = logging.getLogger("video.uploader")

# --------------------------------------------------------------------------- #
#  Register the *existing* staging dir so the rest of the app can look it up
# --------------------------------------------------------------------------- #
MODULE_PATH_DEFAULTS = {"staging": WEB_UPLOADS}
register_module_paths("uploader", MODULE_PATH_DEFAULTS)

WEB_UPLOADS.mkdir(parents=True, exist_ok=True)
log.debug("Uploader staging dir ready: %s", WEB_UPLOADS)

# --------------------------------------------------------------------------- #
#  Side-effect imports – expose router & CLI
# --------------------------------------------------------------------------- #
routes   = import_module(".routes",   __name__)
commands = import_module(".commands", __name__)      # CLI verb (was cli.py)

router = routes.router
__all__ = ["router"]