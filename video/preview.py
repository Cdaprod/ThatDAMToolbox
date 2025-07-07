# /video/preview.py

from pathlib import Path
import subprocess, shutil, logging, os, hashlib

from .config import get_path, get_preview_root

log = logging.getLogger("video.preview")

PREVIEW_ROOT = get_preview_root()

def hash_for_preview(src: Path, block_size=1024 * 1024) -> str:
    """
    Fast content-based hash for preview filenames.
    - Hashes first and last MB for large files, whole file for small.
    - Fallback: hashes resolved file path.
    """
    h = hashlib.sha1()
    try:
        with src.open("rb") as f:
            head = f.read(block_size)
            h.update(head)
            if len(head) == block_size:
                try:
                    f.seek(-block_size, os.SEEK_END)
                    h.update(f.read(block_size))
                except OSError:
                    # File smaller than 2*block_size, just use what we read
                    pass
    except Exception:
        h.update(str(src.resolve()).encode())
    return h.hexdigest()

def make_preview_name(src: Path, hash_value: str = None) -> str:
    """
    Create a robust preview filename: {stem}-{hash8}{ext}.jpg
    - If hash_value not provided, compute on-demand.
    """
    if hash_value is None:
        hash_value = hash_for_preview(src)
    return f"{src.stem}-{hash_value[:10]}.jpg"

def generate_preview(src: Path, dst: Path = None, size: str = "256x144") -> bool:
    """
    Generate a single-frame JPEG preview for `src`.
    If `dst` is None, uses PREVIEW_ROOT/{stem}-{hash8}.jpg.
    Returns True on success, False on failure.
    """
    hashval = hash_for_preview(src)

    # 1. Compute destination path
    if dst is None:
        dst = PREVIEW_ROOT / make_preview_name(src, hashval)

    # 2. Ensure we have a writable directory
    try:
        dst.parent.mkdir(parents=True, exist_ok=True)
    except PermissionError as e:
        log.warning("Cannot create preview directory %s: %s", dst.parent, e)
        return False
    except Exception as e:
        log.error("Unexpected error creating %s: %s", dst.parent, e)
        return False

    # 3. Check ffmpeg availability
    ffmpeg = shutil.which("ffmpeg")
    if not ffmpeg:
        log.warning("ffmpeg not found in PATH; skipping preview")
        return False

    # 4. Run ffmpeg to grab a frame at 3s and scale
    cmd = [
        ffmpeg, "-y",
        "-ss", "3", "-i", str(src),
        "-vframes", "1",
        "-vf", f"scale={size}",
        str(dst)
    ]
    try:
        subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=True
        )
        return True
    except subprocess.CalledProcessError:
        log.warning("ffmpeg failed to generate preview for %s", src)
        return False
    except Exception as e:
        log.error("Error running ffmpeg on %s: %s", src, e)
        return False