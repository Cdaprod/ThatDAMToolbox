#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
video/core/ingest.py
──────────────────────────────────────────────────────────────────────────────
Ingest freshly-arrived media files into the canonical store.

Public helpers
~~~~~~~~~~~~~~
* ingest_files(iterable_of_paths, batch_name=…)
* ingest_folder(directory, batch_name=…, recursive=True, patterns=…)

Both helpers upsert into the global DB singleton (`video.DB`) and move the
files into the sharded MEDIA_ROOT tree (ab/cdef…/abcdef….ext).
"""

from __future__ import annotations

import hashlib
import logging
import shutil
from pathlib import Path
from typing import Iterable, Final, Sequence

from .ports import UsageMeterPort

from video.config import MEDIA_ROOT
from video.probe  import probe_media          # ffprobe helper

_LOG: Final = logging.getLogger(__name__)

# ---------------------------------------------------------------------------#
# ────────── internal helpers ───────────────────────────────────────────────#

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
    """Return the lazily-initialised global MediaDB instance."""
    from video import DB                         # late import avoids cycles
    return DB


# ---------------------------------------------------------------------------#
# ────────── public API – file list ─────────────────────────────────────────#

def ingest_files(
    paths: Iterable[str | Path],
    *,
    batch_name: str | None = None,
    usage_meter: "UsageMeterPort" | None = None,
) -> int:
    """
    Move each *path* to the canonical store and register it in the DB.

    Returns the number of successfully processed files.
    """
    processed = 0

    for raw in paths:
        p = Path(raw)

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
            if usage_meter:
                usage_meter.record_ingest()

        except Exception as exc:                  # noqa: BLE001
            _LOG.exception("Ingest failed for %s: %s", p, exc)

    _LOG.info("Ingest complete – %d item(s) processed", processed)
    return processed


# ---------------------------------------------------------------------------#
# ────────── public API – whole folder convenience ──────────────────────────#

def ingest_folder(
    folder: str | Path,
    *,
    batch_name: str | None = None,
    recursive: bool = True,
    patterns: Sequence[str] = (".mp4", ".mov", ".mkv", ".avi", ".jpg", ".png"),
) -> int:
    """
    Scan *folder* for media files and pass them to ``ingest_files``.

    Parameters
    ----------
    folder
        Directory to scan.
    batch_name
        Optional tag stored alongside each DB record.
    recursive
        Whether to descend into sub-directories.
    patterns
        Tuple of filename suffixes to match (case-insensitive).

    Returns
    -------
    int
        Count of processed files (same as ``ingest_files``).
    """
    folder = Path(folder).expanduser().resolve()
    if not folder.is_dir():
        raise FileNotFoundError(folder)

    suf = tuple(p.lower() for p in patterns)
    files = (
        [p for p in folder.rglob("*") if p.suffix.lower() in suf]
        if recursive else
        [p for p in folder.iterdir()  if p.suffix.lower() in suf]
    )
    _LOG.info("Found %d candidate media files in %s", len(files), folder)

    return ingest_files(files, batch_name=batch_name)


# ---------------------------------------------------------------------------#
# export names
# ---------------------------------------------------------------------------#
__all__ = [
    "ingest_files",
    "ingest_folder",
]