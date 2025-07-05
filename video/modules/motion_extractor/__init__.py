# .../<modules>/motion_extractor/__init__.py
"""
Motion-Extractor plug-in for the Video toolbox.

Adds:
• CLI:   `video motion_extract --video input.mp4 --out frames/`
• REST:  POST /motion/extract
"""
from . import routes, commands      # keep both imports
router = routes.router              # ★ expose for the autoloader

# optionally re-export the class
from .motion_extractor import MotionExtractor   # noqa: F401