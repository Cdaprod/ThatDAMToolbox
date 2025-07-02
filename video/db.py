# video/db.py
"""Database interface module - pure stdlib"""

import sqlite3
import json
from pathlib import Path
from contextlib import contextmanager
from datetime import datetime
from typing import Optional, List, Dict, Any

class MediaDB:
    """SQLite database interface for media files"""
    
    def __init__(self, db_path: Optional[Path] = None):
        self.db_path = db_path or (Path.home() / "media_index.sqlite3")
        self._init_db()
    
    def _init_db(self):
        """Initialize database schema"""
        with self.conn() as cx:
            cx.execute("""
                CREATE TABLE IF NOT EXISTS files (
                    id            TEXT PRIMARY KEY,
                    path          TEXT UNIQUE NOT NULL,
                    size_bytes    INTEGER NOT NULL,
                    mtime         TEXT NOT NULL,
                    mime          TEXT,
                    width_px      INTEGER,
                    height_px     INTEGER,
                    duration_s    REAL,
                    batch         TEXT,
                    sha1          TEXT,
                    created_at    TEXT NOT NULL
                )
            """)
            
            cx.execute("CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime)")
            cx.execute("CREATE INDEX IF NOT EXISTS idx_files_batch ON files(batch)")
            cx.execute("CREATE INDEX IF NOT EXISTS idx_files_sha1 ON files(sha1)")
            
            # Sync tracking table (for photo sync compatibility)
            cx.execute("""
                CREATE TABLE IF NOT EXISTS copies (
                    sha1 TEXT PRIMARY KEY,
                    dest TEXT,
                    ts REAL
                )
            """)
    
    @contextmanager
    def conn(self):
        """Context manager for database connections"""
        cx = sqlite3.connect(self.db_path)
        cx.row_factory = sqlite3.Row
        cx.execute("PRAGMA foreign_keys = ON")
        cx.execute("PRAGMA journal_mode = WAL")
        try:
            yield cx
            cx.commit()
        except Exception:
            cx.rollback()
            raise
        finally:
            cx.close()
    
    def upsert_file(self, row: Dict[str, Any]) -> None:
        """Insert or update a file record"""
        sql = """
        INSERT INTO files
          (id, path, size_bytes, mtime, mime, width_px, height_px,
           duration_s, batch, sha1, created_at)
        VALUES
          (:id, :path, :size_bytes, :mtime, :mime, :width_px, :height_px,
           :duration_s, :batch, :sha1, :created_at)
        ON CONFLICT(path) DO UPDATE SET
          size_bytes = excluded.size_bytes,
          mtime      = excluded.mtime,
          sha1       = excluded.sha1,
          batch      = excluded.batch
        """
        with self.conn() as cx:
            cx.execute(sql, row)
    
    def get_file_by_path(self, path: str) -> Optional[sqlite3.Row]:
        """Get file record by path"""
        with self.conn() as cx:
            return cx.execute("SELECT * FROM files WHERE path = ?", (path,)).fetchone()
    
    def get_file_by_sha1(self, sha1: str) -> Optional[sqlite3.Row]:
        """Get file record by SHA1 hash"""
        with self.conn() as cx:
            return cx.execute("SELECT * FROM files WHERE sha1 = ?", (sha1,)).fetchone()
    
    def list_recent(self, limit: int = 20) -> List[sqlite3.Row]:
        """Get recently indexed files"""
        with self.conn() as cx:
            return cx.execute(
                "SELECT * FROM files ORDER BY created_at DESC LIMIT ?", (limit,)
            ).fetchall()
    
    def list_by_batch(self, batch_name: str) -> List[sqlite3.Row]:
        """Get files by batch/album name"""
        with self.conn() as cx:
            return cx.execute(
                "SELECT * FROM files WHERE batch = ? ORDER BY mtime DESC", (batch_name,)
            ).fetchall()

    def list_all_files(self) -> list[Dict[str, Any]]:
        """Return every row from the files table as a list of dicts."""
        with self.conn() as cx:
            rows = cx.execute("SELECT * FROM files ORDER BY created_at").fetchall()
        # sqlite3.Row is dict-compatible
        return [dict(row) for row in rows]
    
    def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        with self.conn() as cx:
            stats = {}
            
            # Total files
            result = cx.execute("SELECT COUNT(*) FROM files").fetchone()
            stats['total_files'] = result[0]
            
            # Total size
            result = cx.execute("SELECT SUM(size_bytes) FROM files").fetchone()
            stats['total_size_bytes'] = result[0] or 0
            
            # By mime type
            mime_stats = cx.execute("""
                SELECT mime, COUNT(*) as count, SUM(size_bytes) as size
                FROM files 
                GROUP BY mime 
                ORDER BY count DESC
            """).fetchall()
            stats['by_mime'] = [dict(row) for row in mime_stats]
            
            # By batch
            batch_stats = cx.execute("""
                SELECT batch, COUNT(*) as count 
                FROM files 
                WHERE batch IS NOT NULL
                GROUP BY batch 
                ORDER BY count DESC
            """).fetchall()
            stats['by_batch'] = [dict(row) for row in batch_stats]
            
            return stats
    
    def already_copied(self, sha1: str) -> bool:
        """Check if file was already copied (sync compatibility)"""
        with self.conn() as cx:
            result = cx.execute("SELECT 1 FROM copies WHERE sha1 = ?", (sha1,)).fetchone()
            return result is not None
    
    def remember_copy(self, sha1: str, dest: Path):
        """Remember that a file was copied (sync compatibility)"""
        with self.conn() as cx:
            cx.execute(
                "INSERT OR REPLACE INTO copies VALUES (?, ?, ?)",
                (sha1, str(dest), datetime.now().timestamp())
            )
    
    def cleanup_missing_files(self) -> int:
        """Remove records for files that no longer exist"""
        removed = 0
        with self.conn() as cx:
            all_files = cx.execute("SELECT id, path FROM files").fetchall()
            for row in all_files:
                if not Path(row['path']).exists():
                    cx.execute("DELETE FROM files WHERE id = ?", (row['id'],))
                    removed += 1
        return removed