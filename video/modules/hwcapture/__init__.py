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
    
from video.config import register_module_paths, DATA_DIR

# Declare all subdirs your module uses here:
MODULE_PATH_DEFAULTS = {
    "streams": "streams",   # MJPEG/HLS stream outputs
    "records": "records",   # MP4/TS file outputs
}

register_module_paths(
    "hwcapture",
    {k: DATA_DIR / "modules" / "hwcapture" / v for k, v in MODULE_PATH_DEFAULTS.items()}
)

from . import routes, commands   # side-effects register CLI & REST

from .hwcapture import (
    has_hardware_accel as has_hw,
    record, capture, capture_multiple,
    list_video_devices, get_device_info,
    HWAccelRecorder, record_multiple,
    stream_jpeg_frames,
)
from .camerarecorder import CameraRecorder

__all__ = [
    "has_hw", "record", "capture", "capture_multiple",
    "list_video_devices", "get_device_info",
    "CameraRecorder", "record_multiple",  "stream_jpeg_frames",
]