# /video/probe.py
from __future__ import annotations
from pathlib import Path
import subprocess, json, shutil, logging

log = logging.getLogger("video.probe")

def probe_media(path: Path, timeout: int = 10) -> dict | None:
    """Return ffprobe JSON dict or None on failure (stdlib only)."""
    if not shutil.which("ffprobe"):
        log.warning("ffprobe not installed – skipping tech-metadata")
        return None
    cmd = [
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", str(path)
    ]
    try:
        proc = subprocess.run(cmd, check=True, capture_output=True,
                              text=True, timeout=timeout)
        return json.loads(proc.stdout)
    except Exception as exc:
        log.error("ffprobe failed on %s: %s", path, exc)
        return None