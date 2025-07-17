#!/usr/bin/env python3

"""
`video/__init__.py`
That DAM Toolbox – *Pythonista-friendly*, pure-stdlib façade

Updated directory layout (depth ≤ 1)
────────────────────────────────────
video/
├── __init__.py          # this file – high-level API
├── __main__.py          # universal entry-point (CLI ⇄ API)
├── api.py               # FastAPI app object (lazy import)
├── bootstrap.py         # first-run helpers & env checks
├── cli.py               # argparse + sub-commands
├── commands.py          # dataclass DTOs for CLI & TUI
├── config.py            # global settings, paths, env-vars
├── db.py                # SQLite interface + migrations
├── hwaccel.py           # optional FFmpeg HW acceleration helpers
├── paths.py             # canonical path helpers (XDG, iOS, etc.)
├── preview.py           # preview / proxy generation
├── probe.py             # tech-metadata extraction (codec, resolution…)
├── scanner.py           # multithreaded file walker + SHA-1 pipeline
├── server.py            # tiny stdlib HTTP fallback
├── sync.py              # Photos / iCloud / remote importers
├── tui.py               # rich-based TUI frontend
├── schema.sql           # DB schema & migrations
├── video.cfg            # sample INI config
├── video.1              # man-page (generated)
├── test_script.py       # quick self-test / smoke-run
# sub-packages (expand separately)
├── core/                # domain logic split into bounded contexts
├── dam/                 # digital-asset-management utilities
├── helpers/             # misc pure-stdlib helpers
├── models/              # pydantic / dataclass models
├── modules/             # plugin auto-discovery root
├── storage/             # storage back-ends (S3, MinIO, local…)
└── web/                 # static files & SPA frontend bundle

Media Indexer – tiny façade unifying scanner ▸ DB ▸ optional Photos sync.

Typical usage
─────────────
>>> from video import MediaIndexer
>>> idx = MediaIndexer()
>>> idx.scan()                      # walk & index
>>> idx.get_recent(10)              # quick query
>>> idx.backup(Path("/mnt/backups"))

High-level façade for "Cdaprod: That DAM Toolbox" (pure-stdlib).
"""

from __future__ import annotations

import logging, time, sqlite3
from pathlib import Path
from typing import Any, Dict, List, Optional

# ─────────────────────────────────────────────────────────────────────────────
# 1.  Shared database instance – created once with a polite retry
# ─────────────────────────────────────────────────────────────────────────────
from .db import MediaDB as _MediaDB   # real class

def _make_db_with_retry(
    attempts: int = 5,
    backoff_s: float = 1.0,
) -> _MediaDB:
    """
    Create (and migrate) the SQLite file, retrying on the rare
    "database is locked" that can happen when several new workers
    start at the exact same time.
    """
    for n in range(1, attempts + 1):
        try:
            return _MediaDB()         # first attempt
        except sqlite3.OperationalError as exc:
            if "locked" not in str(exc).lower() or n == attempts:
                raise
            time.sleep(backoff_s * n)  # linear back-off and try again

DB: _MediaDB = _make_db_with_retry()   # canonical connection

# Public alias so callers can still say `from video import MediaDB`
MediaDB = _MediaDB                     # type: ignore[attr-defined]

# ─────────────────────────────────────────────────────────────────────────────
from .scanner import Scanner
from .sync     import PhotoSync

log = logging.getLogger(__name__)

class MediaIndexer:
    """
    Glue object that unifies scanner ⇆ DB ⇆ (optional) Photos sync.
    """

    def __init__(
        self,
        *,
        root_path: Path | str | None = None,
        db_path:   Path | str | None = None,
        db:        _MediaDB | None   = None,
    ) -> None:

        # choose which DB instance this indexer should use
        if db is not None:
            self.db = db
        elif db_path is not None:
            self.db = _MediaDB(db_path)   # private instance
        else:
            self.db = DB                  # shared singleton

        self.scanner = Scanner(self.db, root_path)
        self.sync    = PhotoSync(self.db)

        log.debug("MediaIndexer ready (db=%s, root=%s)",
                  self.db.db_path, self.scanner.root_path)

    # ─────────── scanning ───────────
    def scan(self, root_path: Path | None = None, workers: int = 4
             ) -> Dict[str, int]:
        return self.scanner.bulk_scan(root_path, workers)

    # ─────────── queries ───────────
    def get_recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        return self.db.list_recent(limit)

    def get_by_batch(self, batch: str) -> List[Dict[str, Any]]:
        return self.db.list_by_batch(batch)

    def get_all(self) -> List[Dict[str, Any]]:
        return self.db.list_all_files()

    def get_stats(self) -> Dict[str, Any]:
        return self.db.get_stats()

    # ─────────── Photos / sync ───────────
    def sync_photos_album(self, album: str, category: str = "edit"
                          ) -> Dict[str, Any]:
        return self.sync.sync_album(album, category)

    # ─────────── backup helper ───────────
    def backup(self, backup_root: Path) -> Dict[str, Any]:
        import shutil

        copied = skipped = 0
        for rec in self.db.iter_all_files():
            src   = Path(rec["path"])
            sha1  = rec["sha1"]
            batch = rec["batch"] or "_UNSORTED"
            tgt   = backup_root / batch / src.name
            tgt.parent.mkdir(parents=True, exist_ok=True)

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

    # ─────────── one-shot convenience ───────────
    def index_media(
        self,
        *,
        scan_workers: int = 4,
        sync_album:   str | None = None,
        sync_category: str = "edit",
    ) -> Dict[str, Any]:

        stats = self.scan(workers=scan_workers)
        if sync_album:
            stats["photos_sync"] = self.sync_photos_album(sync_album,
                                                          sync_category)
        stats["db"] = self.get_stats()
        return stats


# ── re-export helpers & plug-in discovery ───────────────────────────────────
from . import config as config          # noqa: E402
from .cli import run_cli as _run_cli    # noqa: E402
from .modules import routers            # noqa: E402 (auto-loads plug-ins)

__all__ = [
    "MediaIndexer",
    "MediaDB",  # class alias
    "DB",       # shared instance
    "Scanner",
    "PhotoSync",
    "config",
    "routers",
]