# /video/__init__.py
"""
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
"""

#!/usr/bin/env python3
"""
Media Indexer – tiny façade unifying scanner ▸ DB ▸ optional Photos sync.

Typical usage
─────────────
>>> from video import MediaIndexer
>>> idx = MediaIndexer()
>>> idx.scan()                      # walk & index
>>> idx.get_recent(10)              # quick query
>>> idx.backup(Path("/mnt/backups"))
"""
from __future__ import annotations

from pathlib import Path
import logging
from typing import Any, Dict, List, Optional

from .db import MediaDB
from .scanner import Scanner
from .sync import PhotoSync

log = logging.getLogger("video")

# ────────────────────────────────────────────────────────────────────────────
class MediaIndexer:
    """
    One object → all verbs.

    Parameters
    ----------
    db_path   : Optional[Path|str]  – SQLite file (defaults in video.config)
    root_path : Optional[Path|str]  – where to start scanning
    """

    def __init__(
        self,
        db_path: Path | str | None = None,
        root_path: Path | str | None = None,
    ) -> None:
        self.db: MediaDB = MediaDB(db_path)
        self.scanner: Scanner = Scanner(self.db, root_path)
        self.sync: PhotoSync = PhotoSync(self.db)

        log.debug(
            "MediaIndexer ready (db=%s, root=%s)",
            self.db.db_path,
            self.scanner.root_path,
        )

    # ─────────── scanning ───────────
    def scan(self, root_path: Path | None = None, workers: int = 4) -> Dict[str, int]:
        """Walk `root_path` (defaults to ctor arg) and (re)index media files."""
        return self.scanner.bulk_scan(root_path, workers)

    # ─────────── queries ───────────
    def get_recent(self, limit: int = 20) -> List[Dict[str, Any]]:
        return self.db.list_recent(limit)

    def get_by_batch(self, batch_name: str) -> List[Dict[str, Any]]:
        return self.db.list_by_batch(batch_name)

    def get_all(self) -> List[Dict[str, Any]]:
        return self.db.list_all_files()

    def get_stats(self) -> Dict[str, Any]:
        return self.db.get_stats()

    # ─────────── Photos / sync ───────────
    def sync_photos_album(self, album_name: str, category: str = "edit") -> Dict[str, Any]:
        return self.sync.sync_album(album_name, category)

    # ─────────── backup helper ───────────
    def backup(self, backup_root: Path) -> Dict[str, Any]:
        """
        Copy **indexed** files to `backup_root/<batch>/<filename>` with strong
        idempotence (records each SHA-1 and skips duplicates on next run).
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

    # ─────────── one-shot convenience ───────────
    def index_media(
        self,
        *,
        scan_workers: int = 4,
        sync_album: str | None = None,
        sync_category: str = "edit",
    ) -> Dict[str, Any]:
        """
        Single call suited to CI or GUI:

        1. `scan()` with the given worker count
        2. Optionally import an iOS Photos album
        3. Return merged statistics
        """
        stats = self.scan(workers=scan_workers)
        if sync_album:
            stats["photos_sync"] = self.sync_photos_album(sync_album, sync_category)
        stats["db"] = self.get_stats()
        return stats


# ─── Convenience exports & plugin auto-loading ───────────────────────────────
from . import config as config  # noqa: E402
from .cli import run_cli as _run_cli  # noqa: E402
from .modules import routers  # noqa: E402  (triggers plugin discovery)

__all__ = [
    "MediaIndexer",
    "MediaDB",
    "Scanner",
    "PhotoSync",
    "config",
    "routers",
]