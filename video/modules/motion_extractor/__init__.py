#!/usr/bin/env python3
"""
/video/modules/motion_extractor/__init__.py

Motion-Extractor plug-in for the Video toolbox.

Adds:
• CLI:   `video motion_extract --video input.mp4 --out frames/`
• REST:  POST /motion/extract
"""
from pathlib import Path

# the loader will prepend DATA_DIR / "motion_extractor"
MODULE_PATH_DEFAULTS = {
    "frames":  "frames",
    "outputs": "outputs",
}

from . import routes, commands      # keep both imports
router = routes.router              # ★ expose for the autoloader

# optionally re-export the class
from .motion_extractor import MotionExtractor   # noqa: F401