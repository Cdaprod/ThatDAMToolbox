# /video/db.py
"""Database interface module - pure stdlib"""
from .config import DB_PATH

import sqlite3
from pathlib import Path
from contextlib import contextmanager
from datetime import datetime
from typing import Optional, List, Dict, Any

class MediaDB:
    """SQLite database interface for media files"""

    def __init__(self, db_path: Optional[Path] = None):
        # self.db_path = db_path or (Path.home() / "media_index.sqlite3")
        self.db_path = Path(db_path) if db_path else DB_PATH
        self._init_db()
        try:
            self._repair_fts()
        except Exception as e:
            # Log but never block startup; users don't need to know
            import logging
            logging.getLogger("video.db").warning(f"FTS repair skipped: {e}")


    def _init_db(self):
        """Initialize database schema and perform migrations"""
        with self.conn() as cx:
            # ─── Base table with new columns ───────────────────────────
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
                    created_at    TEXT NOT NULL,
                    version       INTEGER DEFAULT 1,
                    parent_id     TEXT,
                    preview_path  TEXT
                )
            """)
            cx.execute("CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime)")
            cx.execute("CREATE INDEX IF NOT EXISTS idx_files_batch ON files(batch)")
            cx.execute("CREATE INDEX IF NOT EXISTS idx_files_sha1 ON files(sha1)")

            # ─── Sync tracking table ────────────────────────────────────
            cx.execute("""
                CREATE TABLE IF NOT EXISTS copies (
                    sha1 TEXT PRIMARY KEY,
                    dest TEXT,
                    ts   REAL
                )
            """)

            # ─── Full-text search setup ─────────────────────────────────
            # Only on first run (user_version = 0 → set to 1)
            cur_ver = cx.execute("PRAGMA user_version").fetchone()[0]
            if cur_ver < 1:
                cx.executescript("""
                    CREATE VIRTUAL TABLE IF NOT EXISTS files_fts
                    USING fts5(path, mime, batch, content='files', content_rowid='rowid');

                    CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
                      INSERT INTO files_fts(rowid, path, mime, batch)
                      VALUES (new.rowid, new.path, new.mime, new.batch);
                    END;

                    CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
                      DELETE FROM files_fts WHERE rowid = old.rowid;
                    END;

                    CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
                      UPDATE files_fts 
                        SET path = new.path, mime = new.mime, batch = new.batch
                        WHERE rowid = old.rowid;
                    END;

                    PRAGMA user_version = 1;
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
        except:
            cx.rollback()
            raise
        finally:
            cx.close()

    def upsert_file(self, row: Dict[str, Any]) -> None:
        """Insert or update a file record, bumping version if sha1 changed"""
        sql = """
        INSERT INTO files (
          id, path, size_bytes, mtime, mime, width_px, height_px,
          duration_s, batch, sha1, created_at, version, parent_id, preview_path
        ) VALUES (
          :id, :path, :size_bytes, :mtime, :mime, :width_px, :height_px,
          :duration_s, :batch, :sha1, :created_at, 1, NULL, :preview_path
        )
        ON CONFLICT(path) DO UPDATE SET
          size_bytes   = excluded.size_bytes,
          mtime        = excluded.mtime,
          sha1         = excluded.sha1,
          batch        = excluded.batch,
          preview_path = excluded.preview_path,
          version      = files.version + (excluded.sha1 <> files.sha1),
          parent_id    = CASE WHEN (excluded.sha1 <> files.sha1) THEN files.id ELSE files.parent_id END
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

    def list_all_files(self) -> List[Dict[str, Any]]:
        """Return every row from the files table as a list of dicts."""
        with self.conn() as cx:
            rows = cx.execute("SELECT * FROM files ORDER BY created_at").fetchall()
        return [dict(row) for row in rows]

    def iter_all_files(self):
        """Yield one file-row dict at a time (memory-efficient)."""
        with self.conn() as cx:
            for row in cx.execute("SELECT * FROM files ORDER BY created_at"):
                yield dict(row)

    def get_stats(self) -> Dict[str, Any]:
        """Get database statistics"""
        with self.conn() as cx:
            stats: Dict[str, Any] = {}
            # Total files
            stats['total_files'] = cx.execute("SELECT COUNT(*) FROM files").fetchone()[0]
            # Total size
            stats['total_size_bytes'] = cx.execute("SELECT SUM(size_bytes) FROM files").fetchone()[0] or 0
            # By mime
            mime_stats = cx.execute("""
                SELECT mime, COUNT(*) AS count, SUM(size_bytes) AS size
                FROM files
                GROUP BY mime
                ORDER BY count DESC
            """).fetchall()
            stats['by_mime'] = [dict(r) for r in mime_stats]
            # By batch
            batch_stats = cx.execute("""
                SELECT batch, COUNT(*) AS count
                FROM files
                WHERE batch IS NOT NULL
                GROUP BY batch
                ORDER BY count DESC
            """).fetchall()
            stats['by_batch'] = [dict(r) for r in batch_stats]
            return stats

    def already_copied(self, sha1: str) -> bool:
        """Check if file was already copied (sync compatibility)"""
        with self.conn() as cx:
            return cx.execute("SELECT 1 FROM copies WHERE sha1 = ?", (sha1,)).fetchone() is not None

    def remember_copy(self, sha1: str, dest: Path):
        """Remember that a file was copied (sync compatibility)"""
        with self.conn() as cx:
            cx.execute(
                "INSERT OR REPLACE INTO copies(sha1, dest, ts) VALUES (?, ?, ?)",
                (sha1, str(dest), datetime.now().timestamp())
            )

    def cleanup_missing_files(self) -> int:
        """Remove records for files that no longer exist"""
        removed = 0
        with self.conn() as cx:
            for row in cx.execute("SELECT id, path FROM files"):
                if not Path(row['path']).exists():
                    cx.execute("DELETE FROM files WHERE id = ?", (row['id'],))
                    removed += 1
        return removed

    # ─── New utility methods ────────────────────────────────────────────

    def search_files(
            self, q: str,
            mime: Optional[str] = None,
            limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Search by prefix via FTS; fall back to LIKE if term is a stop-word."""
        with self.conn() as cx:
            # ---------- 1. try FTS (fast path) ------------------------------
            sql_fts = """
                SELECT f.*
                  FROM files_fts
                  JOIN files f ON files_fts.rowid = f.rowid
                 WHERE files_fts MATCH ?
            """
            params: List[Any] = [f"{q.strip()}*"]
            if mime:
                sql_fts += " AND f.mime = ?"
                params.append(mime)
            sql_fts += " LIMIT ?"
            params.append(limit)

            rows = cx.execute(sql_fts, params).fetchall()
            if rows:
                return [dict(r) for r in rows]

            # ---------- 2. fall back to LIKE (stop-word safe) ---------------
            like = f"%{q.strip()}%"
            sql_like = """
                SELECT *
                  FROM files
                 WHERE (path  LIKE ? OR
                        batch LIKE ?)
            """
            like_params: List[Any] = [like, like]
            if mime:
                sql_like += " AND mime = ?"
                like_params.append(mime)
            sql_like += " ORDER BY mtime DESC LIMIT ?"
            like_params.append(limit)

            rows = cx.execute(sql_like, like_params).fetchall()
            return [dict(r) for r in rows]
            
    def clean_all(self) -> int:
        """Delete all file records and their FTS entries; return number removed"""
        with self.conn() as cx:
            total = cx.execute("SELECT COUNT(*) FROM files").fetchone()[0]
            cx.execute("DELETE FROM files")
            cx.execute("DELETE FROM files_fts")
        # Always ensure FTS is rebuilt after destructive ops
        self._repair_fts()
        return total

    def _repair_fts(self) -> int:
        """
        Ensure files_fts contains all files rows (backfill for FTS triggers).
        Returns the number of rows added.
        """
        with self.conn() as cx:
            has_fts = cx.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='files_fts'").fetchone()
            if not has_fts:
                return 0
            missing_rowids = cx.execute("""
                SELECT rowid, path, mime, batch FROM files
                WHERE rowid NOT IN (SELECT rowid FROM files_fts)
            """).fetchall()
            for row in missing_rowids:
                cx.execute(
                    "INSERT INTO files_fts(rowid, path, mime, batch) VALUES (?, ?, ?, ?)",
                    (row["rowid"], row["path"], row["mime"], row["batch"])
                )
            return len(missing_rowids)