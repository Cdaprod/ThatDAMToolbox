#!/usr/bin/env python3
"""
Explorer plug-in – browsable media feed & batch viewer.

Adds
• REST  – /explorer/…  (see routes.py)
• CLI   – `video explore …` (see commands.py)
"""

from __future__ import annotations
from importlib import import_module
import logging

from video.config import DATA_DIR
from video.paths import register_module_paths

log = logging.getLogger("video.explorer")

# --------------------------------------------------------------------------- #
#  Declare and register all data folders used by this module
# --------------------------------------------------------------------------- #
MODULE_PATH_DEFAULTS = {
    "cache":   "cache",
    "exports": "exports",
    "thumbs":  "thumbs",
}

register_module_paths(
    "explorer",
    {k: DATA_DIR / "modules" / "explorer" / v for k, v in MODULE_PATH_DEFAULTS.items()},
)
log.debug("Explorer paths registered: %s", MODULE_PATH_DEFAULTS)

# --------------------------------------------------------------------------- #
#  Side-effect imports – make routes & CLI verbs visible to the host app
# --------------------------------------------------------------------------- #
routes   = import_module(".routes",   __name__)
commands = import_module(".commands", __name__)      # defines CLI verb

router = routes.router               # re-export for FastAPI autoload
__all__ = ["router"]