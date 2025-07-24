#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
video/__init__.py
───────────────────────────────────────────────────────────────────────────────
Light-weight public façade – the heavy lifting (storage backend, plug-in
auto-load, legacy patches, WAL snapshot thread, …) happens once in
`video.bootstrap`.

Importing **video** gives you:

    >>> from video import MediaIndexer, DB, STORAGE, routers, config

Public symbols
~~~~~~~~~~~~~~
• MediaIndexer – high-level helper gluing scanner ⇆ DB ⇆ iOS-sync  
• DB / STORAGE – singletons created by *bootstrap*  
• routers      – list of FastAPI routers aggregated from every plug-in  
• config       – runtime-config helper
"""

from __future__ import annotations

import importlib                      # <-- needed for dynamic import below
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

# --------------------------------------------------------------------------- #
# 0.  One-time application bootstrap                                          #
# --------------------------------------------------------------------------- #
# Side-effects: creates STORAGE/DB, auto-loads plug-ins, applies legacy shims
from video import bootstrap as _bootstrap       # noqa: E402  (side-effects!)

DB      = _bootstrap.DB          # backward-compat global
STORAGE = _bootstrap.STORAGE     # advanced callers can poke inside

# FastAPI router list collected by `video.modules.__init__`
routers = importlib.import_module("video.modules").routers

# Re-export config helper (exact same object used everywhere else)
from video import config  # noqa: E402, F401

log = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# 1.  MediaIndexer façade (unchanged)                                         #
# --------------------------------------------------------------------------- #
from .scanner import Scanner        # noqa: E402
from .sync    import PhotoSync      # noqa: E402


class MediaIndexer:
    """
    High-level façade that unifies *scanner ⇆ database ⇆ iOS Photos* workflows.
    """

    def __init__(
        self,
        *,
        root_path: Path | str | None = None,
        db: "video.db.MediaDB" | None = None,
    ) -> None:
        from video.db import MediaDB  # local import avoids import cycle

        self.db: MediaDB = db or DB
        self.scanner     = Scanner(self.db, root_path)
        self.sync        = PhotoSync(self.db)

        log.debug(
            "MediaIndexer ready (db=%s, root=%s)",
            self.db.db_path,
            self.scanner.root_path,
        )

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
            except Exception as exc:               # pragma: no-cover
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


# --------------------------------------------------------------------------- #
# 2.  Public re-exports                                                       #
# --------------------------------------------------------------------------- #
__all__ = [
    "MediaIndexer",
    "DB",
    "STORAGE",
    "routers",
    "config",
]