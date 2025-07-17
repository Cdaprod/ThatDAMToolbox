# video/storage/wal_proxy.py
"""
Drop-in MediaDB wrapper that:
  • tests whether the DB lives on a WAL-capable filesystem
  • if not, forces PRAGMA journal_mode=DELETE
     (or writes to a local tmpfs + flushes)
"""

from __future__ import annotations
import os, subprocess, tempfile, threading, shutil, time
from pathlib import Path
from typing import Optional

from video.db import MediaDB    # your existing SQLite helper

_NET_FS = {b"cifs", b"smb2", b"smb3", b"nfs", b"fuseblk", b"ntfs", b"exfat"}

def _fs_type(path: Path) -> bytes:
    out = subprocess.check_output(["stat", "-f", "-c", "%T", str(path)])
    return out.strip()

class WALProxyDB(MediaDB):
    """A MediaDB that auto-chooses the safest journal mode."""

    def __init__(self, db_path: Optional[Path] = None) -> None:
        db_path = Path(db_path or media_default_path()).expanduser()
        fs = _fs_type(db_path.parent)

        # Decide the strategy *before* MediaDB.__init__ runs
        if fs in _NET_FS:
            os.environ.setdefault("SQLITE_JOURNAL_MODE", "DELETE")
        else:
            os.environ.setdefault("SQLITE_JOURNAL_MODE", "WAL")

        super().__init__(db_path)      # hands off to original logic

        # (Optional) kick off background flusher if we went tmpfs→real
        if fs in _NET_FS and os.environ.get("SQLITE_PROXY_TMPFS") == "1":
            self._start_tmpfs_proxy(db_path)

    # ------------------------------------------------------------------ #
    # OPTIONAL: tmpfs-proxy writeback for high-volume ingestion
    # ------------------------------------------------------------------ #
    def _start_tmpfs_proxy(self, real_db: Path) -> None:
        tmp_dir = Path(tempfile.mkdtemp(prefix="media_db_tmp_"))
        tmp_db  = tmp_dir / real_db.name
        shutil.copyfile(real_db, tmp_db)          # seed

        # swap to the in-memory (tmpfs) DB
        self.db_path = tmp_db

        def _flush():
            while True:
                time.sleep(10)
                try:
                    shutil.copyfile(tmp_db, real_db)
                except Exception as e:
                    import logging; logging.getLogger("video.db").warning(
                        "Flush failed: %s", e)

        t = threading.Thread(target=_flush, daemon=True); t.start()

# convenience for callers that don’t care
def media_default_path() -> Path:
    from video.config import DB_PATH
    return Path(os.getenv("VIDEO_DB_PATH", str(DB_PATH)))