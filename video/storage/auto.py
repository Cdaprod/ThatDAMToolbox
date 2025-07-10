"""
Unified storage wrapper that makes both worlds work together:

* Core media-metadata tables  →  video.db.MediaDB  (pure stdlib, SQLite)
* Optional vector search      →  video.dam.models.storage.VectorStorage

If the DAM extras (transformers, whisper, faiss, …) aren’t installed,
the class still satisfies StorageEngine with just MediaDB.
"""

from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from video.db import MediaDB
from .base   import StorageEngine          # abstract interface

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

        # --- metadata layer -------------------------------------------------
        default_db = Path.home() / "thatdamtoolbox" / "db" / "media_index.sqlite3"
        self._db   = MediaDB(db_path or default_db)

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