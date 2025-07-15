"""
FFmpeg Console plug-in for the Video toolbox.

Adds:
• CLI:   `video ffmpeg_cmd --video input.mov --cmd '...'`
• REST:  POST /ffmpeg/console
"""

from . import commands
from . import routes

from .ffmpeg_console import run_ffmpeg_console  # for direct imports (optional)