"""
Hardware-accelerated helpers for VideoCore VII.
Falls back to vanilla paths automatically.
"""

import shutil, subprocess, os, tempfile, logging

_FFMPEG = shutil.which("ffmpeg") or "/opt/ffmpeg-rpi/bin/ffmpeg"

def has_vc7():
    """Detect usable v4l2_request decoders."""
    if not os.path.exists(_FFMPEG):
        return False
    out = subprocess.check_output([_FFMPEG, "-hide_banner", "-decoders"],
                                  text=True)
    return "h264_v4l2m2m" in out or "hevc_v4l2request" in out

def transcode_hw(src: str, dst: str, vcodec: str = "h264"):
    """
    Use VideoCore VII to transcode `src` → `dst`.
    `vcodec` = 'h264' | 'hevc'.
    """
    if not has_vc7():
        raise RuntimeError("VideoCoreVII codecs not available")

    codec_map = {
        "h264":  "h264_v4l2m2m",
        "hevc":  "hevc_v4l2request"
    }
    cmd = [
        _FFMPEG, "-y",
        "-hwaccel", "v4l2request",
        "-i", src,
        "-c:v", codec_map[vcodec],
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        dst
    ]
    logging.debug("Running: %s", " ".join(cmd))
    subprocess.check_call(cmd)

def frame_iter_hw(src: str):
    """
    Generator yielding decoded frames (numpy BGR) by piping HW-decoded output
    into OpenCV – useful for thumbnails or ML inference.
    """
    import cv2, numpy as np, shlex
    cmd = shlex.split(
        f'{_FFMPEG} -hwaccel v4l2request -i "{src}" -f rawvideo '
        '-pix_fmt bgr24 -'
    )
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    width, height = probe_resolution(src)
    frame_sz = width * height * 3
    while chunk := proc.stdout.read(frame_sz):
        yield np.frombuffer(chunk, np.uint8).reshape((height, width, 3))