"""
/video/modules/trim_idle/__init__.py

Trim-Idle-Frames plug-in for the Video toolbox.

Adds :
• **CLI**  `video trim_idle --video in.mp4 --out out.mp4 [--method ffmpeg]`
• **REST** POST `/trim_idle/`  (multipart-form)

The heavy-lifting lives in :class:`TrimIdleProcessor` (see *trimmer.py*).
"""
from . import routes, commands            # ← keep: auto-registers side-effects
from .trimmer import TrimIdleProcessor    # ← re-export main class

# expose FastAPI router for the toolbox’ auto-loader
router = routes.router

__all__ = ["TrimIdleProcessor", "router"]