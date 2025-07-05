"""
Hardware-capture plug-in for the Video toolbox.

Adds:
• CLI   – `video hw_record …`, `video hw_list`
• REST  – /hwcapture/devices, /hwcapture/stream, /hwcapture/record
"""

from . import routes, commands          #  ← side-effects register our stuff

# re-export helpers so callers can `from video.modules.hwcapture import record`
from .hwcapture import (
    has_hardware_accel as has_hw,
    record, capture, list_video_devices, get_device_info
)

__all__ = [
    "has_hw", "record", "capture",
    "list_video_devices", "get_device_info"
]

# Public directory that *might* be mounted by the core for HLS etc.
PUBLIC_STREAM_DIR = routes.PUBLIC_STREAM_DIR