#!/usr/bin/env python3
"""
Media Indexer - Pure stdlib implementation for Pythonista
Place this in: pythonista/Modules/site-packages(user)/video/

Directory structure:
video/
├── __init__.py         # This file
├── __main__.py         # Universal entry-point
├── db.py               # Database interface
├── cli.py              # all CLI parsing / dispatch
├── commands.py         # dataclasses
├── scanner.py          # File scanning logic
├── probe.py            # Tech-metadata (duration_s, codec, resolution)
├── preview.py          # Builds previews
├── sync.py             # Photo sync integration
└── schema.sql          # Database schema

Usage:
    from video import MediaIndexer
    indexer = MediaIndexer()
    indexer.scan()
    recent = indexer.get_recent()
"""

#!/usr/bin/env python3
from __future__ import annotations
from pathlib import Path      # ← ADD THIS
import logging

from .db import MediaDB
from .scanner import Scanner
from .sync import PhotoSync

class MediaIndexer:
    """Main interface for the media indexer"""
    
    def __init__(self, db_path=None, root_path=None):
        self.db = MediaDB(db_path)
        self.scanner = Scanner(self.db, root_path)
        self.sync = PhotoSync(self.db)
    
    def scan(self, root_path=None, workers=4):
        """Scan for media files and index them"""
        return self.scanner.bulk_scan(root_path, workers)
    
    def get_recent(self, limit=20):
        """Get recently indexed files"""
        return self.db.list_recent(limit)
    
    def get_by_batch(self, batch_name):
        """Get files by batch/album name"""
        return self.db.list_by_batch(batch_name)
    
    def sync_photos_album(self, album_name, category="edit"):
        """Sync a Photos album (for iOS)"""
        return self.sync.sync_album(album_name, category)
    
    def get_stats(self):
        """Get indexer statistics"""
        return self.db.get_stats()
    
    def get_all(self):
        """Get all indexed file metadata."""
        return self.db.list_all_files()
    
    def backup(self, backup_root: Path):
        """
        Copy indexed files to backup_root/<batch>/<filename>.
        Skips any file whose sha1 is already in the copies table.
        """
        import shutil, logging
        log = logging.getLogger("video.backup")

        copied = skipped = 0

        # Use the new generator to stream rows
        for rec in self.db.iter_all_files():
            src = Path(rec["path"])
            sha1 = rec["sha1"]
            batch = rec["batch"] or "_UNSORTED"
            tgt_dir = backup_root / batch
            tgt_dir.mkdir(parents=True, exist_ok=True)
            tgt = tgt_dir / src.name

            # Strong idempotence: skip if we've already recorded this sha1
            if self.db.already_copied(sha1):
                skipped += 1
                continue

            try:
                shutil.copy2(src, tgt)
                # record in copies table so future runs skip it
                self.db.remember_copy(sha1, tgt)
                copied += 1
                log.info("copied %s → %s", src.name, tgt)
            except Exception as e:
                log.warning("skip %s (%s)", src.name, e)
                skipped += 1

        return {"copied": copied, "skipped": skipped, "dest": str(backup_root)}
        
# Convenience imports
from . import config as config
from .cli import run_cli as _run_cli      # optional: importable CLI entry-point

import pkgutil, importlib
for mod in pkgutil.iter_modules(__path__, prefix=f"{__name__}.modules."):
    importlib.import_module(mod.name)     # ← executes your plug-in’s __init__.py

__all__ = ['MediaIndexer', 'MediaDB', 'Scanner', 'PhotoSync', 'config']