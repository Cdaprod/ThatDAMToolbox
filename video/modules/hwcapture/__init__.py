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

# ──────────────────────────────────────────────────────────────────────────────
# 1) Declare your subfolder defaults
#    These are relative to DATA_DIR/hwcapture/…
# ──────────────────────────────────────────────────────────────────────────────
MODULE_PATH_DEFAULTS = {
    "hls":        "hls",
    "recordings": "records",
}

# ──────────────────────────────────────────────────────────────────────────────
# 2) Immediately register them so get_module_path() works in routes.py
# ──────────────────────────────────────────────────────────────────────────────
from video.config import register_module_paths, DATA_DIR

register_module_paths(
    "hwcapture",
    {
        key: DATA_DIR / "hwcapture" / rel
        for key, rel in MODULE_PATH_DEFAULTS.items()
    }
)

# ──────────────────────────────────────────────────────────────────────────────
# 3) Safe to import routes & commands now (they can call get_module_path)
# ──────────────────────────────────────────────────────────────────────────────
from . import routes, commands          # side-effects register CLI & REST

from .hwcapture import (
    has_hardware_accel as has_hw,
    record,
    capture,
    list_video_devices,
    get_device_info,
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

# ──────────────────────────────────────────────────────────────────────────────
# 4) Re-export the now-registered PUBLIC_STREAM_DIR
# ──────────────────────────────────────────────────────────────────────────────
PUBLIC_STREAM_DIR = routes.PUBLIC_STREAM_DIR