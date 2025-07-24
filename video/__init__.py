#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
video/__init__.py
───────────────────────────────────────────────────────────────────────────────
Light-weight façade.  All heavy lifting (storage back-end, plug-in discovery,
legacy shims, WAL snapshot thread, …) is done once in `video.bootstrap`.

Importing **video** gives you

    >>> from video import MediaIndexer, DB, STORAGE, routers, config
"""

from __future__ import annotations

import importlib
import logging
from pathlib import Path
from typing import Any, Dict, List

log = logging.getLogger(__name__)

# ────────────────────────────────────────────────────────────────────────────
# 0.  Local imports that do *not* depend on bootstrap
#     (they only reference `video` at runtime, not import-time)
# ────────────────────────────────────────────────────────────────────────────
from video.scanner import Scanner          # noqa: E402
from video.sync    import PhotoSync        # noqa: E402

# Place-holders – will be overwritten right after bootstrap runs
DB = None
STORAGE = None
routers: list = []                         # FastAPI routers


# ────────────────────────────────────────────────────────────────────────────
# 1.  MediaIndexer façade (defined *before* bootstrap to break the cycle)
# ────────────────────────────────────────────────────────────────────────────
class MediaIndexer:
    """
    One object that unifies *scanner ⇆ database ⇆ iOS Photos* workflows.
    """

    def __init__(
        self,
        *,
        root_path: Path | str | None = None,
        db: "video.db.MediaDB" | None = None,
    ) -> None:
        from video.db import MediaDB          # local import – avoids cycle

        self.db: MediaDB = db or DB           # type: ignore[arg-type]
        self.scanner     = Scanner(self.db, root_path)
        self.sync        = PhotoSync(self.db)

        log.debug("MediaIndexer ready (db=%s, root=%s)",
                  getattr(self.db, "db_path", "?"),
                  self.scanner.root_path)

    # ── Scanner helpers ────────────────────────────────────────────────────
    def scan(self, root_path: Path | None = None, workers: int = 4) -> Dict[str, int]:
        return self.scanner.bulk_scan(root_path, workers)

    def get_recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        return self.db.list_recent(limit)

    def get_by_batch(self, batch_name: str) -> List[Dict[str, Any]]:
        return self.db.list_by_batch(batch_name)

    def get_all(self) -> List[Dict[str, Any]]:
        return self.db.list_all_files()

    def get_stats(self) -> Dict[str, Any]:
        return self.db.get_stats()

    # ── iOS Photos helpers ────────────────────────────────────────────────
    def sync_photos_album(self, album_name: str, category: str = "edit") -> Dict[str, Any]:
        return self.sync.sync_album(album_name, category)

    # ── Backup helper ─────────────────────────────────────────────────────
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
            except Exception as exc:  # pragma: no-cover
                log.warning("Skip %s (%s)", src.name, exc)
                skipped += 1

        return {"copied": copied, "skipped": skipped, "dest": str(backup_root)}

    # ── Convenience combo ────────────────────────────────────────────────
    def index_media(
        self,
        *,
        scan_workers: int = 4,
        sync_album: str | None = None,
        sync_category: str = "edit",
    ) -> Dict[str, Any]:
        stats = self.scan(workers=scan_workers)
        if sync_album:
            stats["photos_sync"] = self.sync_photos_album(sync_album, sync_category)
        stats["db"] = self.get_stats()
        return stats


# ────────────────────────────────────────────────────────────────────────────
# 2.  Run bootstrap *once* – now that MediaIndexer is available
# ────────────────────────────────────────────────────────────────────────────
from video import bootstrap as _bootstrap      # noqa: E402  (side-effects!)

DB      = _bootstrap.DB
STORAGE = _bootstrap.STORAGE

# The list of plug-in routers filled by video.modules.__init__
routers = importlib.import_module("video.modules").routers


# ────────────────────────────────────────────────────────────────────────────
# 3.  Re-export config helper
# ────────────────────────────────────────────────────────────────────────────
from video import config  # noqa: E402, F401


# ────────────────────────────────────────────────────────────────────────────
# 4.  Public API
# ────────────────────────────────────────────────────────────────────────────
__all__ = [
    "MediaIndexer",
    "DB",
    "STORAGE",
    "routers",
    "config",
]