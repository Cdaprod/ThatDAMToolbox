# /video/preview.py
from pathlib import Path
import subprocess, shutil, logging

log = logging.getLogger("video.preview")

def generate_preview(src: Path, dst: Path, size: str = "256x144") -> bool:
    """Return True if ffmpeg wrote dst."""
    if not shutil.which("ffmpeg"):
        log.warning("ffmpeg missing – cannot render preview")
        return False
    dst.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        "ffmpeg", "-y",
        "-ss", "3", "-i", str(src),
        "-vframes", "1",
        "-vf", f"scale={size}",
        str(dst)
    ]
    ok = subprocess.call(cmd,
                         stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL) == 0
    if not ok:
        log.warning("ffmpeg failed on %s", src)
    return ok