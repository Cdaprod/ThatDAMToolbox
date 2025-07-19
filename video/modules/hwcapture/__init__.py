#!/usr/bin/env python3
"""
Hardware-capture plug-in for the Video toolbox.

Adds:
• CLI   – `video hw_list`, `video hw_record`, `video rec_start`, `video rec_stop`
• REST  – GET  /hwcapture/devices
           GET  /hwcapture/stream
           POST /hwcapture/record          (legacy)
           POST /hwcapture/record/start
           POST /hwcapture/record/stop
"""

from . import routes, commands          # side-effects register CLI & REST
from .hwcapture import (
    has_hardware_accel as has_hw,
    record, capture, list_video_devices, get_device_info
)
from .camerarecorder import CameraRecorder

# Just declare your subfolders (loader will do the rest)
MODULE_PATH_DEFAULTS = {
    "hls":        "hls",
    "recordings": "records"
}

__all__ = [
    "has_hw", "record", "capture",
    "list_video_devices", "get_device_info",
    "CameraRecorder",
]