# video/storage/auto.py
"""
Unified storage wrapper that makes both worlds work together:

* Core media-metadata tables  →  video.db.MediaDB  (pure stdlib, SQLite)
* Optional vector search      →  video.modules.dam.models.storage.VectorStorage

If the DAM extras (transformers, whisper, faiss, …) aren’t installed,
the class still satisfies StorageEngine with just MediaDB.
"""

from __future__ import annotations

import os
import asyncio
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from video.db import MediaDB
from video.storage.base   import StorageEngine          # abstract interface
from video.storage.wal_proxy import WALProxyDB
from video.config import DB_PATH

log = logging.getLogger("video.auto_store")


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _ensure_event_loop_running(coro):
    """
    Ensure an asyncio loop is running so we can await DAM initialisation
    even when called from sync code (e.g. CLI).
    """
    try:
        loop = asyncio.get_running_loop()
        return loop.create_task(coro)      # fire-and-forget in existing loop
    except RuntimeError:
        return asyncio.run(coro)           # no loop → run to completion

# ---------------------------------------------------------------------------
# main adapter
# ---------------------------------------------------------------------------

class AutoStorage(StorageEngine):
    """
    Concrete implementation that fulfils the StorageEngine contract, while
    transparently delegating:

        * file / batch metadata  →  MediaDB  (always available)
        * vector I/O + search    →  VectorStorage, if import succeeds

    Parameters
    ----------
    db_path : str | Path | None
        SQLite file for MediaDB; defaults to `$DATA_DIR/db/media_index.sqlite3`.
    backend : str
        Vector backend name ('weaviate', 'milvus', 'faiss', 'memory', …).
    cfg     : dict | None
        Optional config passed straight through to the vector layer.
    """

    def __init__(self,
                 db_path : str | Path | None = None,
                 backend : str               = "memory",
                 cfg     : Dict[str, Any] | None = None):
        # if someone passed the storage-backend name as first arg (e.g. "auto", "sqlite", "faiss", …)
        # instead of a real filesystem path, swap it into the backend parameter
        if isinstance(db_path, str) and not Path(db_path).is_absolute():
            # treat any non‐absolute string as a backend name
            backend, db_path = db_path, None


        # --- metadata layer -------------------------------------------------
        default_db = Path.home() / "thatdamtoolbox" / "db" / "media_index.sqlite3"
        # Use the same DB_PATH that config.py already created under /data/db
        self._db = WALProxyDB(db_path or DB_PATH)

  
        # --- vector layer (optional) ----------------------------------------
        try:
            # Local import keeps stdlib-only installs happy
            from video.modules.dam.models.storage import VectorStorage
            self._vec = VectorStorage(backend=backend, config=cfg or {})
            _ensure_event_loop_running(self._vec.initialize())
            log.info("Vector backend '%s' ready", backend)
        except Exception as e:
            log.warning("VectorStorage unavailable – %s", e)
            self._vec = None

    # -----------------------------------------------------------------------
    # StorageEngine implementation
    # -----------------------------------------------------------------------

    # ---- VIDEO / METADATA --------------------------------------------------

    def add_video(self, path: str, sha1: str, meta: Dict[str, Any] | None = None) -> None:
        """Insert or update a video row in MediaDB."""
        row = {
            "sha1"     : sha1,
            "path"     : str(path),
            "mime"     : meta.get("mime")  if meta else None,
            "duration" : meta.get("duration") if meta else None,
            "width"    : meta.get("width") if meta else None,
            "height"   : meta.get("height") if meta else None,
            "metadata" : meta or {},
        }
        self._db.upsert_file(row)

    def get_video(self, sha1: str) -> Optional[Dict[str, Any]]:
        return self._db.get_file_by_sha1(sha1)

    def list_videos(self, limit: int = 50, offset: int = 0) -> List[Dict[str, Any]]:
        return self._db.list_recent(limit=limit)[offset:]

    # ------------------------------------------------------------------ #
    # Explorer & DAM convenience helpers                                 #
    # ------------------------------------------------------------------ #

    # ───── sidebar list ────────────────────────────────────────────────
    def list_batches(self) -> list[dict]:
        """
        Return one row per batch (or '_UNSORTED') with a file-count and the
        timestamp of the most recent item.  Used by the Explorer left-hand
        navigation.
        """
        q = """
            SELECT COALESCE(batch,'_UNSORTED') AS batch,
                   COUNT(*)                    AS count,
                   MAX(created_at)             AS last_added
            FROM   files
            GROUP  BY COALESCE(batch,'_UNSORTED')
            ORDER  BY last_added DESC
        """
        return [dict(r) for r in self._db.execute(q)]

    # ───── cards for one batch ─────────────────────────────────────────
    def list_by_batch(self, batch: str) -> list[dict]:
        q = """
            SELECT *
            FROM   files
            WHERE  COALESCE(batch,'_UNSORTED') = ?
            ORDER  BY sort_order, created_at DESC
        """
        return [dict(r) for r in self._db.execute(q, (batch,))]

    # ───── flat folder list (tree is built client-side) ────────────────
    def list_all_folders(self) -> list[dict]:
        rows     = self._db.execute("SELECT path FROM files")
        folders  = {os.path.dirname(r["path"]) for r in rows}
        return [
            {
                "id":        f"folder_{abs(hash(f))}",
                "name":      os.path.basename(f) or f,
                "path":      f,
                "parent_id": f"folder_{abs(hash(os.path.dirname(f)))}",
            }
            for f in folders
        ]

    # ───── direct children of one folder ───────────────────────────────
    def list_assets(self, folder: Path) -> list[dict]:
        like = f"{folder.as_posix().rstrip('/')}/%"
        rows = self._db.execute("SELECT * FROM files WHERE path LIKE ?", (like,))

        def _row_to_asset(r):
            mime = r["mime"] or ""
            _kind = (
                "image"     if mime.startswith("image/")
                else "video"    if mime.startswith("video/")
                else "document"
            )
            return {
                "id"      : r["sha1"],
                "name"    : os.path.basename(r["path"]),
                "type"    : _kind,
                "size"    : r["size_bytes"] or 0,
                "created" : r["created_at"],
                "modified": r["updated_at"],
                "path"    : r["path"],
                "tags"    : json.loads(r["tags"] or "[]"),
                "status"  : r.get("status", "processed"),
                "thumbnail": f"/static/thumbs/{r['sha1']}_0.jpg",
            }

        return [_row_to_asset(r) for r in rows]

    # ───── drag-and-drop sort-order persistence ────────────────────────
    def set_position(self, sha1: str, pos: int) -> None:
        with self._db.conn() as cx:
            cx.execute("UPDATE files SET sort_order=? WHERE sha1=?", (pos, sha1))
            cx.commit()

    # ------------------------------------------------------------------ #
    # Simple passthroughs to MediaDB that higher layers rely on          #
    # ------------------------------------------------------------------ #
    def list_recent(self, limit: int = 50) -> list[dict]:
        rows = self._db.execute(
            "SELECT sha1, path, width_px AS width, height_px AS height,"
            "       mime, created_at "
            "FROM   files "
            "ORDER  BY created_at DESC "
            "LIMIT  ?",
            (limit,),
        )
        return [dict(r) for r in rows]

    # ---- VECTORS / SEARCH --------------------------------------------------

    def add_vector(               # ← out-dented: class-level method
        self,
        sha1: str,
        level: str,
        vector: List[float],
        start_time: float = 0.0,
        end_time: float = 0.0,
        metadata: Dict[str, Any] | None = None,
    ) -> None:
        if not self._vec:
            log.debug("Vector layer missing; vector ignored")
            return
        _ensure_event_loop_running(
            self._vec.store_level_vectors(
                sha1,
                level,
                [
                    {
                        "vector": vector,
                        "start_time": start_time,
                        "end_time": end_time,
                        "metadata": metadata or {},
                    }
                ],
            )
        )

    def search_vector(
        self,
        vector: List[float],
        level: str = "all",
        limit: int = 20,
        threshold: float = 0.7,
    ) -> List[Dict[str, Any]]:
        if not self._vec:
            raise RuntimeError("Vector backend not configured")
        fut = self._vec.search_vectors(
            vector, level=level, limit=limit, threshold=threshold
        )
        return asyncio.run(fut)

    # ---- clean-up ----------------------------------------------------------

    def close(self) -> None:
        """Flush and close resources (blocking)."""
        if self._vec and self._vec.initialized:
            asyncio.run(self._vec.close())