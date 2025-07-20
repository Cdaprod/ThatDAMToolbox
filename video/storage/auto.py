# video/storage/auto.py
"""
Unified storage wrapper that makes both worlds work together:

* Core media-metadata tables  →  video.db.MediaDB  (pure stdlib, SQLite)
* Optional vector search      →  video.dam.models.storage.VectorStorage

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

def set_position(self, sha1: str, pos: int) -> None:
    cur = self._db.execute(
        "UPDATE videos SET sort_order=? WHERE sha1=?",
        (pos, sha1)
    )
    self._db.commit()

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

        # --- metadata layer -------------------------------------------------
        default_db = Path.home() / "thatdamtoolbox" / "db" / "media_index.sqlite3"
        #self._db   = MediaDB(db_path or default_db) # Disabled for video.storage.wal_proxy
        self._db = WALProxyDB(db_path or default_db)

        # --- vector layer (optional) ----------------------------------------
        try:
            # Local import keeps stdlib-only installs happy
            from video.dam.models.storage import VectorStorage
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

    # ------------------------------------------------------------------
    # Simple passthroughs to MediaDB that higher layers rely on
    # ------------------------------------------------------------------
    def list_recent(self, limit: int = 50) -> list[dict]:
        rows = self._db.execute(
            "SELECT sha1, path, width, height, mime, created_at "
            "FROM videos ORDER BY created_at DESC LIMIT ?",
            (limit,)
        )
        return [dict(r) for r in rows]

        def list_all_folders(self) -> list[dict]:
            # Get all distinct directories from the videos table
            rows = self._db.execute(
                "SELECT DISTINCT path FROM videos"
            )
            # Extract folder paths and build folder info objects
            folders = set()
            for r in rows:
                folder = os.path.dirname(r['path'])
                folders.add(folder)
            # Map to explorer-expected shape (add id, parent if you like)
            return [
                {
                    "id": f"folder_{abs(hash(folder))}",  # or use folder path
                    "name": os.path.basename(folder) or folder,
                    "path": folder,
                    "parent_id": f"folder_{abs(hash(os.path.dirname(folder)))}"
                }
                for folder in folders
            ]

        def list_assets(self, folder: Path) -> list[dict]:
            # Return all videos whose path is under the given folder
            rows = self._db.execute(
                "SELECT * FROM videos WHERE path LIKE ?",
                (str(folder) + "/%",)
            )
            return [dict(r) for r in rows]

            # ---- VECTORS / SEARCH --------------------------------------------------

            def add_vector(self,
                           sha1: str,
                           level: str,
                           vector: List[float],
                           start_time: float = 0.0,
                           end_time  : float = 0.0,
                           metadata  : Dict[str, Any] | None = None) -> None:
                if not self._vec:
                    log.debug("Vector layer missing; vector ignored")
                    return
                _ensure_event_loop_running(
                    self._vec.store_level_vectors(
                        sha1, level,
                        [{"vector": vector,
                          "start_time": start_time,
                          "end_time": end_time,
                          "metadata": metadata or {}}]
                    )
                )

    def search_vector(self,
                      vector: List[float],
                      level: str        = "all",
                      limit: int        = 20,
                      threshold: float  = 0.7) -> List[Dict[str, Any]]:
        if not self._vec:
            raise RuntimeError("Vector backend not configured")
        fut = self._vec.search_vectors(vector, level=level,
                                       limit=limit, threshold=threshold)
        return asyncio.run(fut)

    # ---- clean-up ----------------------------------------------------------

    def close(self) -> None:
        """Flush and close resources (blocking)."""
        if self._vec and self._vec.initialized:
            asyncio.run(self._vec.close())