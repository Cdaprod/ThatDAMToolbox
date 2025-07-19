#!/usr/bin/env python3
"""
Hardware-capture plug-in for the Video toolbox.

Adds:
• CLI   – `video hw_list`, `video hw_record`, `video rec_start`, `video rec_stop`
• REST  – GET  /hwcapture/devices
           GET  /hwcapture/stream
           POST /hwcapture/record
           POST /hwcapture/record/start
           POST /hwcapture/record/stop
"""

from . import routes, commands   # side-effects register CLI & REST

from .hwcapture import (
    has_hardware_accel as has_hw,
    record, capture,
    list_video_devices, get_device_info,
)
from .camerarecorder import CameraRecorder

__all__ = [
    "has_hw", "record", "capture",
    "list_video_devices", "get_device_info",
    "CameraRecorder",
]

# re-export the HLS dir you defined in routes.py
PUBLIC_STREAM_DIR = routes.PUBLIC_STREAM_DIR