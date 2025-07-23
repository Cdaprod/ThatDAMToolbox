"""
# video/core/ingest.py

Ingest freshly-arrived media files into the canonical store.

Steps per file
--------------
1.  Compute SHA-1
2.  Move / rename into a two-level sharded tree under ``MEDIA_ROOT``
3.  ffprobe → tech-metadata
4.  Upsert DB row and optionally tag with *batch_name*
"""

from __future__ import annotations

import hashlib
import logging
import shutil
from pathlib import Path
from typing import Iterable, Final

from video.config import MEDIA_ROOT
from video.probe import probe_media           # ffprobe helper

_LOG: Final = logging.getLogger(__name__)

# ---------------------------------------------------------------------------#
# ────────── helpers ────────────────────────────────────────────────────────#

def _sha1(path: Path, *, buf_size: int = 1 << 20) -> str:
    """Return the hexadecimal SHA-1 of *path* (streamed, constant-memory)."""
    h = hashlib.sha1()
    with path.open("rb") as fh:
        while chunk := fh.read(buf_size):
            h.update(chunk)
    return h.hexdigest()


def _target_for_digest(digest: str, suffix: str) -> Path:
    """
    Map a SHA-1 digest + extension to a deterministic location:

        ab/cdef…/abcdef….ext
    """
    shard, rest = digest[:2], digest[2:]
    return MEDIA_ROOT / shard / rest / f"{digest}{suffix.lower()}"


def _db():
    """
    Return the *fully-initialised* singleton ``video.DB`` without importing it
    at module import-time.  Avoids circular-import headaches.
    """
    from video import DB  # noqa: WPS433 – intentional late import
    return DB


# ---------------------------------------------------------------------------#
# ────────── public API ─────────────────────────────────────────────────────#

def ingest_files(
    paths: Iterable[str | Path],
    *,
    batch_name: str | None = None,
) -> None:
    """
    Move each *path* to the canonical store and register it in the DB.

    Notes
    -----
    * If the destination file already exists it will **not** be overwritten
      and the staging copy is discarded silently.
    * Any exception on an individual file is logged and the ingest continues.
    """
    processed = 0

    for raw in paths:
        p = Path(raw)

        # Quick sanity check – skip directories & missing files early
        if not p.is_file():
            _LOG.warning("Skip non-file %s", p)
            continue

        try:
            digest = _sha1(p)
            dest   = _target_for_digest(digest, p.suffix)
            dest.parent.mkdir(parents=True, exist_ok=True)

            # ── Move or deduplicate ────────────────────────────────────
            if dest.exists():
                p.unlink(missing_ok=True)
                _LOG.info("△ duplicate %s (already at %s)", p.name, dest)
            else:
                shutil.move(str(p), dest)
                _LOG.info("→ %s  %s", digest[:8], dest)

            # ── Probe & DB upsert ──────────────────────────────────────
            meta = probe_media(dest)
            _db().add_video(
                path=dest,
                sha1=digest,
                meta={**meta, "batch": batch_name},
            )

            processed += 1

        except Exception as exc:      # noqa: BLE001 – we really want *any* error
            _LOG.exception("Ingest failed for %s: %s", p, exc)

    _LOG.info("Ingest complete – %d item(s) processed", processed)


__all__ = ["ingest_files"]