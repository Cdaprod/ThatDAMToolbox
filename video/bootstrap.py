#!/usr/bin/env python3
"""
/video/bootstrap.py

Smart bootstrap for the *video* API.

• If Docker is available → run the pre-built container
• Else if FastAPI+Uvicorn installed → run in-process
• Else → fall back to the pure-stdlib HTTP server

A singleton `STORAGE` is created at import-time via
`video.storage.auto.AutoStorage`, so *all* parts of the codebase
(`video.db`, DAM models, legacy scanner, …) share one concrete backend.
"""
from __future__ import annotations

import importlib.util as _iu
import logging
import os
import sqlite3, shutil, threading, time
import subprocess
from typing import Optional
from pathlib import Path

from video.storage.auto import AutoStorage  # ← new backend dispatcher

# --------------------------------------------------------------------------- #
# helpers                                                                     #
# --------------------------------------------------------------------------- #
_log = logging.getLogger("video.bootstrap")


def _banner(app) -> None:
    """Pretty-print every JSON API route the moment the service boots."""
    from fastapi.routing import APIRoute  # local import → optional dep
    from starlette.routing import Mount

    _log.info("📚  Available endpoints:")

    for r in sorted(app.routes, key=lambda _r: getattr(_r, "path", "")):

        # real JSON endpoints only
        if isinstance(r, APIRoute):
            if not getattr(r, "include_in_schema", True):
                continue
            methods = [m for m in r.methods if m not in ("HEAD", "OPTIONS")]
            _log.info("  %-7s %s", ",".join(methods), r.path)

        # ignore static mounts, etc.
        elif isinstance(r, Mount):
            continue


def _have_docker() -> bool:
    exe = shutil.which("docker")
    if not exe:
        return False
    try:
        subprocess.check_output([exe, "info"], stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


# --------------------------------------------------------------------------- #
# storage - the single source of truth                                        #
# --------------------------------------------------------------------------- #
STORAGE = AutoStorage(os.getenv("VIDEO_STORAGE", "sqlite"))  # default → sqlite


# --------------------------------------------------------------------------- #
# public entry-point                                                          #
# --------------------------------------------------------------------------- #
def start_server(
    host: str = "0.0.0.0",
    port: int = 8080,
    *,
    use_docker: Optional[bool] = None,
    **uvicorn_opts,
) -> None:
    """
    Decide **once** where to run the API and launch it.

    Called by: `python -m video serve …` or `video.cli → serve`
    """
    # 1) Launch a host-level Docker container if requested / available
    if use_docker is None:
        use_docker = os.getenv("VIDEO_USE_DOCKER") == "1" or _have_docker()

    if use_docker:
        image = os.getenv("VIDEO_DOCKER_IMAGE", "cdaprod/video:latest")
        cmd = [
            "docker",
            "run",
            "--rm",
            "-p",
            f"{port}:{port}",
            "-e",
            "VIDEO_FORCE_STDHTTP=0",
            image,
        ]
        _log.info("🛳️  launching host container: %s", " ".join(cmd))
        subprocess.run(cmd, check=True)
        return

    # 2) In-process (FastAPI) or stdlib fallback
    force_std = os.getenv("VIDEO_FORCE_STDHTTP") == "1"
    have_fast = _iu.find_spec("fastapi") is not None
    have_uci = _iu.find_spec("uvicorn") is not None

    if not force_std and have_fast and have_uci:
        from video.api import app
        import uvicorn

        _banner(app)

        workers = int(os.getenv("UVICORN_WORKERS", uvicorn_opts.pop("workers", "1")))
        # if multiple workers or reload: use import string
        app_ref = "video.api:app" if (workers > 1 or uvicorn_opts.get("reload")) else app
        uvicorn.run(app_ref, host=host, port=port, workers=workers, **uvicorn_opts)
    else:
        from video.server import serve

        serve(host=host, port=port)
        

# --------------------------------------------------------------------------- #
# background DB-checkpoint / backup                                          #
# --------------------------------------------------------------------------- #
def _start_db_backup() -> None:
    """
    Periodically checkpoint WAL ➜ main DB file **and**
    copy it atomically to the network share.

    Tunables (env vars)
    -------------------
    DB_SNAPSHOT_SECS   – interval in seconds (default 300)
    VIDEO_DB_PATH      – path to the *live* db (defaults to STORAGE._db.db_path)
    VIDEO_DB_BACKUP    – destination file on the network share
                          (defaults to '/data/db/media_index.sqlite3')
    """
    interval  = int(os.getenv("DB_SNAPSHOT_SECS", "300"))
    db_path   = Path(os.getenv("VIDEO_DB_PATH", str(STORAGE._db.db_path)))
    backup_to = Path(os.getenv("VIDEO_DB_BACKUP",
                               "/data/db/media_index.sqlite3")).expanduser()

    log = logging.getLogger("video.db.backup")
    log.info("⏳  DB snapshot every %ss  (%s ➜ %s)", interval, db_path, backup_to)

    def _loop() -> None:
        while True:
            try:
                # 1️⃣  flush WAL into main db file
                with sqlite3.connect(db_path) as cx:
                    cx.execute("PRAGMA wal_checkpoint(TRUNCATE);")

                # 2️⃣  atomic copy to network share
                tmp = backup_to.with_suffix(".tmp")
                shutil.copy2(db_path, tmp)
                tmp.replace(backup_to)
                log.debug("✔ checkpointed → %s", backup_to)
            except Exception as exc:        # pragma: no cover
                log.warning("⚠ snapshot failed: %s", exc)

            time.sleep(interval)

    threading.Thread(target=_loop,
                     daemon=True,
                     name="db-backup").start()

# fire it up immediately on module import
if os.getenv("VIDEO_DB_BACKUP_DISABLE", "0") != "1":
    _start_db_backup()