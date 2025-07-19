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

from pathlib import Path

# ── Declare your subfolder defaults before any imports ────────────────────
MODULE_PATH_DEFAULTS = {
    # core will register:
    #   DATA_DIR/hwcapture/hls
    #   DATA_DIR/hwcapture/records
    "hls":        "hls",
    "recordings": "records",
}

from . import routes, commands          # ← now safe: registry is populated
from .hwcapture import (
    has_hardware_accel as has_hw,
    record, capture, list_video_devices, get_device_info
)
from .camerarecorder import CameraRecorder

__all__ = [
    "has_hw",
    "record",
    "capture",
    "list_video_devices",
    "get_device_info",
    "CameraRecorder",
]

# Expose the registered HLS directory (and any others you need)
PUBLIC_STREAM_DIR = routes.PUBLIC_STREAM_DIR