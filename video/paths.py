from pathlib import Path
import os, tempfile

# honour an env-var so users can override
_BASE = Path(os.getenv("VIDEO_TMP", "/tmp/video-scratch"))

def get_tmp_subdir(name: str) -> Path:
    """
    Return (and create) a writable sub-directory for temporary artefacts.

        >>> frames_dir = get_tmp_subdir("frames")
    """
    sub = _BASE / name
    sub.mkdir(parents=True, exist_ok=True)
    return sub