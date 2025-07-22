"""
/video/db.py  – stand-alone replacement

SQLite helper – one canonical connection for the whole Video stack.
"""

from __future__ import annotations
import time
import tempfile
import atexit
import sqlite3, os
from pathlib    import Path
from contextlib import contextmanager
from datetime   import datetime
from typing     import Optional, List, Dict, Any

import fcntl  # Linux-only; use portalocker for cross-platform if you need Mac/Windows

from .config import DB_PATH                     # resolved by video.config

# ─────────────────────────────────────────────────────────────────────────────
DB_FILE        = Path(os.getenv("VIDEO_DB_PATH", str(DB_PATH))).expanduser()
_BOOTSTRAPPED  = False                # guarded WAL initialisation flag

# ─────────────────────────────────────────────────────────────────────────────
class MediaDB:
    """Thin wrapper around SQLite + a few convenience helpers."""

    def __init__(self, db_path: Optional[Path] = None) -> None:
        print(f"MediaDB.__init__: {self=} db_path={db_path} resolved={db_path or DB_FILE}")
        self.db_path = Path(db_path) if db_path else DB_FILE

        self._lockfile_path = self.db_path.with_suffix('.init.lock')
        self._lockfile_path.parent.mkdir(parents=True, exist_ok=True)
        if not os.access(self._lockfile_path.parent, os.W_OK):
            tmpdir = Path(os.getenv("VIDEO_TMP_DIR", tempfile.gettempdir()))
            tmpdir.mkdir(parents=True, exist_ok=True)
            self._lockfile_path = tmpdir / (self.db_path.name + ".init.lock")

        # Clean up stale lockfile if present
        if self._lockfile_path.exists():
            print(f"WARNING: Stale DB lockfile detected at {self._lockfile_path}, cleaning up.")
            try:
                self._lockfile_path.unlink()
            except Exception as e:
                print(f"Could not remove stale lockfile {self._lockfile_path}: {e}")

        def _cleanup_lockfile(path=self._lockfile_path):
            try:
                if path.exists():
                    path.unlink()
            except Exception:
                pass

        atexit.register(_cleanup_lockfile)

        with open(self._lockfile_path, "w") as lockfile:
            import fcntl
            fcntl.flock(lockfile, fcntl.LOCK_EX)
            try:
                global _BOOTSTRAPPED
                if not _BOOTSTRAPPED:
                    self._bootstrap_wal()
                    _BOOTSTRAPPED = True

                self._init_db()
                try:
                    self._repair_fts()
                except Exception as exc:
                    import logging
                    logging.getLogger("video.db").warning("FTS repair skipped: %s", exc)
            finally:
                fcntl.flock(lockfile, fcntl.LOCK_UN)
                try:
                    self._lockfile_path.unlink()
                except Exception:
                    pass
                
    def _bootstrap_wal(self) -> None:
        """
        Try to enable WAL once.  If the underlying filesystem
        (e.g. SMB / NFS) rejects it with "database is locked",
        fall back to DELETE mode so the DB remains usable.
        """
        import logging
        log = logging.getLogger("video.db")

        log.info("Initialising SQLite DB at %s", self.db_path)

        try:
            # -- first (and only) attempt at WAL ----------------------------
            with sqlite3.connect(self.db_path, timeout=5) as cx:
                cx.execute("PRAGMA journal_mode=WAL;")
                cx.execute("PRAGMA synchronous=NORMAL;")
                cx.execute("PRAGMA busy_timeout=5000;")
            log.info("journal_mode=WAL enabled successfully")
            return                                    # ✅ all good
        except sqlite3.OperationalError as exc:
            if "locked" not in str(exc).lower():
                raise                                # some unrelated error
            # ----------------------------------------------------------------
            # WAL isn’t supported (common on network shares).  Downgrade.
            # ----------------------------------------------------------------
            log.warning(
                "WAL unsupported on this filesystem (%s). "
                "Falling back to journal_mode=DELETE.", exc
            )
            with sqlite3.connect(self.db_path, timeout=5) as cx:
                cx.execute("PRAGMA journal_mode=DELETE;")
                cx.execute("PRAGMA synchronous=NORMAL;")
                cx.execute("PRAGMA busy_timeout=5000;")
            log.info("journal_mode=DELETE in effect – continuing without WAL")

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
            cx.execute("CREATE INDEX IF NOT EXISTS idx_files_sha1 ON files(sha1);")

            cx.execute("""
              CREATE TABLE IF NOT EXISTS copies (
                  sha1 TEXT PRIMARY KEY,
                  dest TEXT,
                  ts   REAL
              );
            """)

            if cx.execute("PRAGMA user_version").fetchone()[0] < 1:
                cx.executescript("""
                  CREATE VIRTUAL TABLE files_fts
                  USING fts5(
                    path, mime, batch,
                    content='files', content_rowid='rowid'
                  );
                  CREATE TRIGGER files_ai AFTER INSERT ON files BEGIN
                    INSERT INTO files_fts(rowid,path,mime,batch)
                    VALUES (new.rowid,new.path,new.mime,new.batch);
                  END;
                  CREATE TRIGGER files_ad AFTER DELETE ON files BEGIN
                    DELETE FROM files_fts WHERE rowid=old.rowid;
                  END;
                  CREATE TRIGGER files_au AFTER UPDATE ON files BEGIN
                    UPDATE files_fts
                       SET path=new.path, mime=new.mime, batch=new.batch
                     WHERE rowid=old.rowid;
                  END;
                  PRAGMA user_version=1;
                """)

    @contextmanager
    def conn(self):
        cx = sqlite3.connect(
            self.db_path,
            timeout=30,
            check_same_thread=False,
            isolation_level=None
        )
        cx.row_factory = sqlite3.Row
        cx.execute("PRAGMA foreign_keys=ON;")
        cx.execute("PRAGMA busy_timeout=5000;")
        cx.execute("PRAGMA cache_size = -2000;")  # limit to 2MB RAM
        try:
            yield cx
            cx.commit()
            cx.execute("PRAGMA wal_checkpoint(TRUNCATE);")
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
            exists = cx.execute(
                "SELECT name FROM sqlite_master WHERE type='table' AND name='files_fts'"
            ).fetchone()
            if not exists:
                return 0
            missing = cx.execute("""
              SELECT rowid,path,mime,batch
                FROM files
               WHERE rowid NOT IN (SELECT rowid FROM files_fts)
            """).fetchall()
            for r in missing:
                cx.execute(
                  "INSERT INTO files_fts(rowid,path,mime,batch) VALUES (?,?,?,?)",
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