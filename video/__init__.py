#!/usr/bin/env python3
from __future__ import annotations

"""
/video/__init__.py

That DAM Toolbox – *Pythonista-friendly*, pure-stdlib façade

Updated directory layout (depth ≤ 1)
────────────────────────────────────
video/
.
├── core/
├── dam/
├── helpers/
├── models/
├── modules/
├── storage/
├── web/ # Depricated for Next.js app "cdaprod/video-web-app
├── __init__.py
├── __main__.py
├── api.py
├── bootstrap.py
├── cli.py
├── commands.py
├── config.py
├── db.py
├── hwaccel.py
├── lifecycle.py
├── paths.py
├── preview.py
├── probe.py
├── README.md
├── scanner.py
├── schema.sql
├── server.py
├── sync.py
├── test_script.py
├── tui.py
├── video.1
├── video-2.cfg
├── video.cfg
└── ws.py

9 directories, 23 files

Media Indexer – tiny façade unifying scanner ▸ DB ▸ optional Photos sync.

Typical usage
─────────────
>>> from video import MediaIndexer
>>> idx = MediaIndexer()
>>> idx.scan()                      # walk & index
>>> idx.get_recent(10)              # quick query
>>> idx.backup(Path("/mnt/backups"))
"""

import os, logging

LOG_LEVEL = os.getenv("VIDEO_LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    force=True,          # clobber any handler Uvicorn might inject later
)

import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

# ── shared / global objects ────────────────────────────────────────────────
import video.core.auto                   # Zero-Touch Legacy Code
from .db import MediaDB as _MediaDB # SQLite Helper

def _make_db_with_retry(
    attempts: int = 5,
    backoff_s: float = 1.0,
) -> _MediaDB:
    """
    Create the global MediaDB instance, retrying on 'database is locked'
    errors that can occur when several workers start simultaneously.
    """
    for n in range(1, attempts + 1):
        try:
            return _MediaDB()
        except sqlite3.OperationalError as exc:
            if "locked" not in str(exc).lower() or n >= attempts:
                raise
            print(f"[video/init] DB locked, retry {n}/{attempts} ...")
            time.sleep(backoff_s * n)


print(f"video/__init__.py: Creating DB singleton (MediaDB)")
print(f"INITIALIZING DB: {__name__} in {__file__}")
if os.getenv("VIDEO_DEBUG_BOOT") == "1":
    import traceback; traceback.print_stack()

# canonical, shared connection
DB: _MediaDB = _make_db_with_retry()

# Public alias so callers can still say `from video import MediaDB`
MediaDB = _MediaDB  # type: ignore[attr-defined]

from .scanner import Scanner
from .sync import PhotoSync

log = logging.getLogger("video")

class MediaIndexer:
    """
    One high-level façade object that glues together scanner ⇆ DB ⇆ sync.

    Parameters
    ----------
    root_path : Path | str | None
        Directory to scan (defaults to config.MEDIA_ROOT).
    db_path   : Path | str | None
        Custom SQLite file – **rarely needed**. If given, a private
        `MediaDB(db_path)` is created instead of re-using the global `DB`.
    db        : MediaDB | None
        Pass an explicit MediaDB instance (test doubles, in-memory DB, …).
    """

    def __init__(
        self,
        *,
        root_path: Path | str | None = None,
        db_path: Path | str | None = None,
        db: _MediaDB | None = None,
    ) -> None:
        if db is not None:
            self.db = db
        elif db_path is not None:
            self.db = _MediaDB(db_path)
        else:
            self.db = DB

        self.scanner: Scanner = Scanner(self.db, root_path)
        self.sync: PhotoSync = PhotoSync(self.db)

        log.debug(
            "MediaIndexer ready (db=%s, root=%s)",
            self.db.db_path,
            self.scanner.root_path,
        )

    def scan(self, root_path: Path | None = None, workers: int = 4) -> Dict[str, int]:
        """Walk `root_path` (defaults to ctor arg) and (re)index media files."""
        return self.scanner.bulk_scan(root_path, workers)

    def get_recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        return self.db.list_recent(limit)

    def get_by_batch(self, batch_name: str) -> List[Dict[str, Any]]:
        return self.db.list_by_batch(batch_name)

    def get_all(self) -> List[Dict[str, Any]]:
        return self.db.list_all_files()

    def get_stats(self) -> Dict[str, Any]:
        return self.db.get_stats()

    def sync_photos_album(self, album_name: str, category: str = "edit") -> Dict[str, Any]:
        return self.sync.sync_album(album_name, category)

    def backup(self, backup_root: Path) -> Dict[str, Any]:
        """
        Copy **indexed** files to `backup_root/<batch>/<filename>` with strong
        idempotence (skips SHA-1s already copied on previous runs).
        """
        import shutil

        copied = skipped = 0
        for rec in self.db.iter_all_files():
            src = Path(rec["path"])
            sha1 = rec["sha1"]
            batch = rec["batch"] or "_UNSORTED"
            tgt_dir = backup_root / batch
            tgt_dir.mkdir(parents=True, exist_ok=True)
            tgt = tgt_dir / src.name

            if self.db.already_copied(sha1):
                skipped += 1
                continue

            try:
                shutil.copy2(src, tgt)
                self.db.remember_copy(sha1, tgt)
                copied += 1
                log.info("Copied %s → %s", src.name, tgt)
            except Exception as exc:
                log.warning("Skip %s (%s)", src.name, exc)
                skipped += 1

        return {"copied": copied, "skipped": skipped, "dest": str(backup_root)}

    def index_media(
        self,
        *,
        scan_workers: int = 4,
        sync_album: str | None = None,
        sync_category: str = "edit",
    ) -> Dict[str, Any]:
        """
        1. scan()
        2. optional Photos import
        3. return merged stats
        """
        stats = self.scan(workers=scan_workers)
        if sync_album:
            stats["photos_sync"] = self.sync_photos_album(sync_album, sync_category)
        stats["db"] = self.get_stats()
        return stats

# ── re-export helpers & plugin auto-loading ─────────────────────────────────
from . import config as config        # noqa: E402
from .cli import run_cli as _run_cli  # noqa: E402
from .modules import routers          # noqa: E402

__all__ = [
    "MediaIndexer",
    "MediaDB",  # class alias
    "DB",       # shared instance
    "Scanner",
    "PhotoSync",
    "config",
    "routers",
]