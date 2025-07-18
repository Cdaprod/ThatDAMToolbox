# video/core/ingest.py
"""
Background ingest helpers
-------------------------
Called by the uploader route (or CLI) to hash, index and move freshly
uploaded files into the canonical media store.
"""

from __future__ import annotations
from pathlib import Path
import shutil, hashlib, logging

from video.config import INCOMING_DIR, MEDIA_ROOT
from video        import DB
from video.probe  import probe_media     # ← your existing ffprobe helper

log = logging.getLogger("video.ingest")
#DB  = MediaDB()                         # singleton that owns its own engine


# --------------------------------------------------------------------------- #
# helpers                                                                     #
# --------------------------------------------------------------------------- #
def _sha1_of_file(path: Path, buf_size: int = 1 << 20) -> str:
    h = hashlib.sha1()
    with path.open("rb") as f:
        while chunk := f.read(buf_size):
            h.update(chunk)
    return h.hexdigest()


def _dest_for_hash(sha1: str, ext: str) -> Path:
    """Store as /media/ab/cdef…/sha1.ext to avoid giant flat dirs."""
    sub  = sha1[:2]          # ‘ab’
    rest = sha1[2:]          # ‘cdef…’
    return MEDIA_ROOT / sub / rest / f"{sha1}{ext.lower()}"


# --------------------------------------------------------------------------- #
# public API                                                                  #
# --------------------------------------------------------------------------- #
def ingest_files(paths: list[str] | list[Path], *, batch_name: str | None):
    """
    • Compute SHA-1  
    • Move to MEDIA_ROOT in a 2-level sharded tree  
    • Probe tech-metadata (width/height/etc.)  
    • Upsert DB row and link to *batch_name* (creates batch if missing)
    """
    for p in map(Path, paths):
        try:
            sha1  = _sha1_of_file(p)
            dest  = _dest_for_hash(sha1, p.suffix)
            dest.parent.mkdir(parents=True, exist_ok=True)

            # If file already exists, no need to copy again
            if not dest.exists():
                shutil.move(str(p), dest)
                log.info("→ %s  %s", sha1[:8], dest)
            else:
                # clean staging copy
                p.unlink(missing_ok=True)
                log.info("△ duplicate %s already indexed", sha1[:8])

            # tech-metadata
            meta = probe_media(dest)
            #DB.upsert_file(dest, batch_name=batch_name, meta=meta)
            DB.add_video(path=dest, sha1=sha1, meta=meta | {"batch": batch_name})

        except Exception as e:
            log.exception("failed to ingest %s: %s", p, e)

    log.info("Ingest complete – %d item(s) processed", len(paths))


__all__ = ["ingest_files"]