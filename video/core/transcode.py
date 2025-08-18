# /video/core/transcode.py
"""Software-based video transcoding helpers.

Example:
    transcode_sw("in.mov", "out.mp4", vcodec="h264")
"""

from __future__ import annotations
import shutil
import subprocess
from typing import Literal

__all__ = ["transcode_sw"]


def transcode_sw(src: str, dst: str, vcodec: Literal["h264", "hevc"] = "h264") -> None:
    """Transcode ``src`` to ``dst`` using ffmpeg (CPU).

    Raises ``RuntimeError`` if ffmpeg is not available.
    """
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        raise RuntimeError("ffmpeg not found in PATH")
    codec_map = {"h264": "libx264", "hevc": "libx265"}
    cmd = [
        ffmpeg,
        "-y",
        "-i",
        src,
        "-c:v",
        codec_map[vcodec],
        "-pix_fmt",
        "yuv420p",
        dst,
    ]
    subprocess.check_call(cmd)
