#!/usr/bin/env python3
"""
Media Indexer - Pure stdlib implementation for Pythonista
Place this in: pythonista/Modules/site-packages(user)/video/

Directory structure:
video/
├── __init__.py          # This file
├── db.py               # Database interface
├── scanner.py          # File scanning logic
├── sync.py             # Photo sync integration
└── schema.sql          # Database schema

Usage:
    from video import MediaIndexer
    indexer = MediaIndexer()
    indexer.scan()
    recent = indexer.get_recent()
"""

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

# Convenience imports
__all__ = ['MediaIndexer', 'MediaDB', 'Scanner', 'PhotoSync']