#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
video/__init__.py
───────────────────────────────────────────────────────────────────────────────
❖  Lightweight public façade – all heavy boot-strap work happens in
   ``video.bootstrap`` (storage back-end, plug-in discovery, legacy shims,
   background snapshot thread, …).

What you get by importing **video**:

    >>> from video import MediaIndexer, DB, STORAGE, routers, config
    >>> idx = MediaIndexer(); idx.scan()

Public symbols
~~~~~~~~~~~~~~
• **MediaIndexer** – high-level helper that glues scanner ⇆ DB ⇆ iOS-sync  
• **DB / STORAGE** – aliases to the singletons created by *bootstrap*  
• **routers**      – list of FastAPI routers aggregated from every plug-in  
• **config**       – runtime configuration helper (paths, env, etc.)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

# --------------------------------------------------------------------------- #
# 0.  Initialise the application                                              #
# --------------------------------------------------------------------------- #
# Import *once* – executes: storage creation, plug-in auto-load, legacy patches
from video import bootstrap as _bootstrap  # noqa: E402  (side-effects matter)

DB       = _bootstrap.DB        # backward-compat global
STORAGE  = _bootstrap.STORAGE   # advanced callers can poke inside
routers  = _bootstrap.importlib.import_module(  # populated by bootstrap
    "video.modules"
).routers

# Re-export config helper (exact same object used throughout the code-base)
from video import config  # noqa: E402, F401

log = logging.getLogger(__name__)

# --------------------------------------------------------------------------- #
# 1.  MediaIndexer façade                                                     #
# --------------------------------------------------------------------------- #
from .scanner import Scanner          # noqa: E402
from .sync    import PhotoSync        # noqa: E402


class MediaIndexer:
    """
    One object that unifies *scanner ⇆ database ⇆ iOS Photos* workflows.

    Parameters
    ----------
    root_path : Path | str | None   – directory to index (defaults to MEDIA_ROOT)
    db        : video.db.MediaDB    – you can inject a test double
    """

    def __init__(
        self,
        *,
        root_path: Path | str | None = None,
        db: "video.db.MediaDB" | None = None,
    ) -> None:
        from video.db import MediaDB  # local to avoid import cycle

        self.db: MediaDB = db or DB
        self.scanner     = Scanner(self.db, root_path)
        self.sync        = PhotoSync(self.db)

        log.debug(
            "MediaIndexer ready (db=%s, root=%s)",
            self.db.db_path,
            self.scanner.root_path,
        )

    # --------------------------------------------------------------------- #
    # Scanner helpers                                                       #
    # --------------------------------------------------------------------- #
    def scan(self, root_path: Path | None = None, workers: int = 4) -> Dict[str, int]:
        """Walk *root_path* (defaults to ctor arg) and index media files."""
        return self.scanner.bulk_scan(root_path, workers)

    def get_recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        return self.db.list_recent(limit)

    def get_by_batch(self, batch_name: str) -> List[Dict[str, Any]]:
        return self.db.list_by_batch(batch_name)

    def get_all(self) -> List[Dict[str, Any]]:
        return self.db.list_all_files()

    def get_stats(self) -> Dict[str, Any]:
        return self.db.get_stats()

    # --------------------------------------------------------------------- #
    # iOS Photos helpers                                                    #
    # --------------------------------------------------------------------- #
    def sync_photos_album(self, album_name: str, category: str = "edit") -> Dict[str, Any]:
        return self.sync.sync_album(album_name, category)

    # --------------------------------------------------------------------- #
    # Backup helper                                                         #
    # --------------------------------------------------------------------- #
    def backup(self, backup_root: Path) -> Dict[str, Any]:
        """
        Copy *indexed* files into ``backup_root/<batch>/<filename>`` while
        skipping anything whose SHA-1 was already copied earlier.
        """
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

    # --------------------------------------------------------------------- #
    # Convenience combo                                                     #
    # --------------------------------------------------------------------- #
    def index_media(
        self,
        *,
        scan_workers: int = 4,
        sync_album: str | None = None,
        sync_category: str = "edit",
    ) -> Dict[str, Any]:
        """
        1. scan()  2. optional iOS Photos import  3. merged DB stats
        """
        stats       = self.scan(workers=scan_workers)
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