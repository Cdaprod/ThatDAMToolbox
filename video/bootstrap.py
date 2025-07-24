#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
/video/bootstrap.py

One-shot bootstrap that every part of *That DAM Toolbox* relies on.

What happens here (in this specific order)
──────────────────────────────────────────
1.  Define helpers + `start_server` early (needed by plug-ins / CLI)
2.  Create STORAGE → make sure we have a concrete MediaDB instance in `DB`
3.  Fix container-volume ownership (if running as non-root)
4.  Discover & import every `video.modules.*` plug-in
5.  Apply legacy monkey-patches (`video.core.auto`)
6.  Start WAL-checkpoint → snapshot background thread
7.  Install graceful-shutdown hooks
"""

from __future__ import annotations

import importlib
import importlib.util as _iu
import logging
import os
import shutil
import sqlite3
import subprocess
import threading
import time
from pathlib import Path
from typing import Optional

# ────────────────────────── logging set-up ────────────────────────────
log = logging.getLogger("video.bootstrap")
log.setLevel(logging.INFO)

# ─────────────────────  early helpers & server launcher ───────────────
def _have_docker() -> bool:
    exe = shutil.which("docker")
    if not exe:
        return False
    try:
        subprocess.check_output([exe, "info"], stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        return False


def _banner(app) -> None:
    """Pretty-print registered FastAPI routes."""
    from fastapi.routing import APIRoute
    from starlette.routing import Mount

    log.info("📚  Available endpoints:")
    for r in sorted(app.routes, key=lambda _r: getattr(_r, "path", "")):
        if isinstance(r, APIRoute) and getattr(r, "include_in_schema", True):
            methods = ",".join(x for x in r.methods if x not in ("HEAD", "OPTIONS"))
            log.info("  %-7s %s", methods, r.path)
        elif isinstance(r, Mount):
            continue


def start_server(
    host: str = "0.0.0.0",
    port: int = 8080,
    *,
    use_docker: bool | None = None,
    **uvicorn_opts,
) -> None:
    """
    Launch the API (Docker ▸ Uvicorn ▸ stdlib fallback).

    Exposed early so that `video.cli` or plug-ins can import it without
    triggering circular-import errors.
    """
    # 1️⃣  Host-level Docker container -----------------------------------
    if use_docker is None:
        use_docker = os.getenv("VIDEO_USE_DOCKER") == "1" or _have_docker()

    if use_docker:
        image = os.getenv("VIDEO_DOCKER_IMAGE", "cdaprod/video:latest")
        cmd = ["docker", "run", "--rm",
               "-p", f"{port}:{port}",
               "-e", "VIDEO_FORCE_STDHTTP=0",
               image]
        log.info("🛳️  Launching container: %s", " ".join(cmd))
        subprocess.run(cmd, check=True)
        return

    # 2️⃣  In-process FastAPI + Uvicorn ----------------------------------
    force_std = os.getenv("VIDEO_FORCE_STDHTTP") == "1"
    have_fast = _iu.find_spec("fastapi") is not None
    have_uci  = _iu.find_spec("uvicorn") is not None

    if not force_std and have_fast and have_uci:
        from video.api import app
        import uvicorn

        _banner(app)
        workers = int(os.getenv("UVICORN_WORKERS",
                                uvicorn_opts.pop("workers", "1")))
        app_ref = "video.api:app" if (workers > 1 or uvicorn_opts.get("reload")) else app
        uvicorn.run(app_ref, host=host, port=port, workers=workers, **uvicorn_opts)
        return

    # 3️⃣  Std-lib fallback ---------------------------------------------
    from video.server import serve
    serve(host=host, port=port)


# ────────────────────────── 0. STORAGE / DB ───────────────────────────
from video.storage.auto import AutoStorage  # lightweight import

STORAGE = AutoStorage(os.getenv("VIDEO_STORAGE", "sqlite"))

# Ensure `DB` is a *real* MediaDB instance **before** legacy patches run
try:
    DB = STORAGE._db            # type: ignore[attr-defined]
except AttributeError:
    DB = None  # fall back below

if DB is None:
    from video.db import MediaDB  # heavy import only if necessary

    DB = MediaDB()                # creates /var/lib/…/live.sqlite3 by default
    try:
        STORAGE._db = DB          # keep both references in sync
    except Exception:
        pass

# ─────────────── 1. container permission fix-up (optional) ────────────
def _fix_permissions(target: Path) -> None:
    uid = int(os.getenv("APP_UID", "1000"))
    gid = int(os.getenv("APP_GID", "1000"))
    if not target.exists():
        return
    for p in target.rglob("*"):
        try:
            os.chown(p, uid, gid, follow_symlinks=False)
        except PermissionError:
            pass
    try:
        os.chown(target, uid, gid, follow_symlinks=False)
    except PermissionError:
        pass


_fix_permissions(Path("/var/lib/thatdamtoolbox/db"))
_fix_permissions(Path("/data"))

# ─────────────── 2. discover & import every plug-in ────────────────────
def _load_plugins() -> None:
    """
    Import every `video.modules.*` package exactly once so their
    side-effects register CLI verbs / FastAPI routers.
    """
    import pkgutil
    from video import modules      # namespace pkg

    for mod in pkgutil.iter_modules(modules.__path__, prefix="video.modules."):
        if mod.name.split(".")[-1].startswith("__"):
            continue
        importlib.import_module(mod.name)


_load_plugins()     # executed immediately

# ─────────────── 3. legacy monkey-patches (needs DB) ───────────────────
import video.core.auto  # noqa: F401  (patches on import)

# ─────────────── 4. WAL checkpoint → snapshot thread ───────────────────
def _start_db_backup() -> None:
    if os.getenv("VIDEO_DB_BACKUP_DISABLE", "0") == "1":
        return

    interval  = int(os.getenv("DB_SNAPSHOT_SECS", "300"))
    db_path   = Path(os.getenv("VIDEO_DB_PATH", str(DB.db_path)))
    backup_to = Path(os.getenv("VIDEO_DB_BACKUP",
                               "/data/db/media_index.sqlite3"))

    def _loop() -> None:
        while True:
            try:
                with sqlite3.connect(db_path) as cx:
                    cx.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                tmp = backup_to.with_suffix(".tmp")
                shutil.copy2(db_path, tmp)
                tmp.replace(backup_to)
                log.debug("DB snapshot → %s", backup_to)
            except Exception as exc:
                log.warning("DB snapshot failed: %s", exc)
            time.sleep(interval)

    threading.Thread(target=_loop, daemon=True, name="db-backup").start()


_start_db_backup()

# ─────────────── 5. graceful shutdown / ^C hooks ───────────────────────
import video.lifecycle  # noqa: F401  (sets up SIGTERM & atexit handlers)

# ─────────────── 6. public symbols ─────────────────────────────────────
__all__ = [
    "STORAGE",
    "DB",
    "start_server",
]