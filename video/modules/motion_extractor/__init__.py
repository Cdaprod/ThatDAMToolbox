"""
Motion-Extractor plug-in for the Video toolbox.

Adds:
• CLI:   `video motion_extract --video input.mp4 --out frames/`
• REST:  POST /motion/extract
"""

# 1) Ensure core discovers our new verb & router
from . import commands    # registers CLI verb via decorator
from . import routes      # exposes FastAPI router (if FastAPI path active)

# 2) Re-export convenience class for direct importers
from .extractor import MotionExtractor           # noqa: F401