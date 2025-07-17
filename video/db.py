# /video/db.py  – stand-alone replacement
"""SQLite helper – one canonical connection for the whole Video stack."""

from __future__ import annotations
import time
import sqlite3, os
from pathlib    import Path
from contextlib import contextmanager
from datetime   import datetime
from typing     import Optional, List, Dict, Any

from .config import DB_PATH                     # resolved by video.config

# ─────────────────────────────────────────────────────────────────────────────
DB_FILE        = Path(os.getenv("VIDEO_DB_PATH", str(DB_PATH))).expanduser()
_BOOTSTRAPPED  = False                # guarded WAL initialisation flag

# ─────────────────────────────────────────────────────────────────────────────
class MediaDB:
    """Thin wrapper around SQLite + a few convenience helpers."""

    # ── ctor ────────────────────────────────────────────────────────────────
    def __init__(self, db_path: Optional[Path] = None) -> None:
        self.db_path = Path(db_path) if db_path else DB_FILE

        # 1. **once per interpreter** put the file into WAL mode
        global _BOOTSTRAPPED
        if not _BOOTSTRAPPED:
            self._bootstrap_wal()
            _BOOTSTRAPPED = True

        # 2. create / migrate schema
        self._init_db()

        # 3. make sure the FTS mirror is in sync (best-effort)
        try:
            self._repair_fts()
        except Exception as exc:       # pragma: no cover
            import logging
            logging.getLogger("video.db").warning("FTS repair skipped: %s", exc)

    # ── one-off WAL initialiser ────────────────────────────────────────────
    def _bootstrap_wal(self, attempts: int = 5, backoff_s: float = 1.0) -> None:
        """
        Put the DB into WAL mode. Retries a few times if another process
        is holding the schema lock at the exact same moment.
        """
        for n in range(1, attempts + 1):
            try:
                with sqlite3.connect(self.db_path, timeout=30) as cx:
                    cx.execute("PRAGMA journal_mode = WAL;")   # durable concurrency
                    cx.execute("PRAGMA synchronous  = NORMAL;")# good balance
                    cx.execute("PRAGMA busy_timeout = 5000;")  # polite wait
                return                      # success – we're done
            except sqlite3.OperationalError as exc:
                # Only retry on the classic "database is locked" race
                if "locked" not in str(exc).lower() or n == attempts:
                    raise
                time.sleep(backoff_s * n)   # linear back-off and retry
                
    # ── schema & migrations ─────────────────────────────────────────────────
    def _init_db(self) -> None:
        with self.conn() as cx:
            cx.execute("""
              CREATE TABLE IF NOT EXISTS files (
                  id           TEXT PRIMARY KEY,
                  path         TEXT UNIQUE NOT NULL,
                  size_bytes   INTEGER NOT NULL,
                  mtime        TEXT NOT NULL,
                  mime         TEXT,
                  width_px     INTEGER,
                  height_px    INTEGER,
                  duration_s   REAL,
                  batch        TEXT,
                  sha1         TEXT,
                  created_at   TEXT NOT NULL,
                  version      INTEGER DEFAULT 1,
                  parent_id    TEXT,
                  preview_path TEXT
              );
            """)
            cx.execute("CREATE INDEX IF NOT EXISTS idx_files_mtime ON files(mtime);")
            cx.execute("CREATE INDEX IF NOT EXISTS idx_files_batch ON files(batch);")
            cx.execute("CREATE INDEX IF NOT EXISTS idx_files_sha1  ON files(sha1);")

            # copies table (album-sync bookkeeping)
            cx.execute("""
              CREATE TABLE IF NOT EXISTS copies (
                  sha1 TEXT PRIMARY KEY,
                  dest TEXT,
                  ts   REAL
              );
            """)

            # ---- FTS5 (lazy-created on very first run) --------------------
            if cx.execute("PRAGMA user_version").fetchone()[0] < 1:
                cx.executescript("""
                  CREATE VIRTUAL TABLE files_fts
                  USING fts5(path, mime, batch, content='files', content_rowid='rowid');

                  CREATE TRIGGER files_ai AFTER INSERT ON files BEGIN
                    INSERT INTO files_fts(rowid,path,mime,batch)
                    VALUES (new.rowid,new.path,new.mime,new.batch);
                  END;
                  CREATE TRIGGER files_ad AFTER DELETE ON files BEGIN
                    DELETE FROM files_fts WHERE rowid = old.rowid;
                  END;
                  CREATE TRIGGER files_au AFTER UPDATE ON files BEGIN
                    UPDATE files_fts
                       SET path=new.path, mime=new.mime, batch=new.batch
                     WHERE rowid = old.rowid;
                  END;

                  PRAGMA user_version = 1;
                """)

    # ── tiny connection helper ──────────────────────────────────────────────
    @contextmanager
    def conn(self):
        cx = sqlite3.connect(
            self.db_path,
            timeout=30,
            check_same_thread=False,
            isolation_level=None           # autocommit – plays well with WAL
        )
        cx.row_factory = sqlite3.Row
        cx.execute("PRAGMA foreign_keys = ON;")
        cx.execute("PRAGMA busy_timeout = 5000;")
        try:
            yield cx
            cx.commit()
        except Exception:
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


    # Only _repair_fts() implementation shown – keep the rest of your helpers
    def _repair_fts(self) -> int:
        with self.conn() as cx:
            if not cx.execute(
                "SELECT 1 FROM sqlite_master WHERE type='table' AND name='files_fts'"
            ).fetchone():
                return 0
            missing = cx.execute("""
              SELECT rowid, path, mime, batch
                FROM files
               WHERE rowid NOT IN (SELECT rowid FROM files_fts)
            """).fetchall()
            for r in missing:
                cx.execute(
                  "INSERT INTO files_fts(rowid,path,mime,batch)VALUES(?,?,?,?)",
                  (r["rowid"], r["path"], r["mime"], r["batch"])
                )
            return len(missing)

# ---------------------------------------------------------------------------
# module-level singleton: **import once, use everywhere**
# ---------------------------------------------------------------------------

# DB = MediaDB()         # noqa: E305  (lint: two blank lines before top-level var)

#---------------------------------------------------------------------------
# NOTE                                                                      
# A single, shared instance is now created in **video/__init__.py** so that
# all import paths converge on the same object and we avoid start-up races. 
# ---------------------------------------------------------------------------