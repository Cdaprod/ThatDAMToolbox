#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
/video/bootstrap.py

Single source of truth for process start-up
───────────────────────────────────────────
1.  Creates the singleton storage / DB backend (`STORAGE`)
2.  Fixes volume permissions inside a container
3.  Loads every plug-in under **video.modules.\***   → collects routers / CLI verbs
4.  Imports `video.core.auto` so legacy helpers are monkey-patched
5.  Starts background WAL-checkpoint → snapshot thread
6.  Exposes `start_server()` – chooses Docker, Uvicorn or stdlib HTTP

Nothing else in the code-base needs to import plug-ins or patch legacy
functions – do **all** of it here exactly once.
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

# ──────────────────────────────  logging  ──────────────────────────────
log = logging.getLogger("video.bootstrap")
log.setLevel(logging.INFO)

# ────────────────────────── 0. storage singleton ───────────────────────
from video.storage.auto import AutoStorage  # light import

STORAGE = AutoStorage(os.getenv("VIDEO_STORAGE", "sqlite"))
DB = STORAGE._db   # backward-compat alias

# ───────────── 1. fix permissions when running inside a container ──────
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

# ──────────────── 2. plug-in discovery (video.modules.*) ───────────────
def _load_plugins() -> None:
    """
    Import every package under ``video.modules`` exactly once.
    Side-effects in each plug-in register routers and CLI verbs.
    """
    import pkgutil
    from video import modules  # namespace package

    for mod in pkgutil.iter_modules(modules.__path__, prefix="video.modules."):
        if mod.name.split(".")[-1].startswith("__"):
            continue
        importlib.import_module(mod.name)


_load_plugins()  # run immediately

# ──────────────── 3. legacy shims (MediaDB.add_video, …) ───────────────
import video.core.auto  # noqa: F401  (patches on import)

# ─────────── 4. WAL checkpoint → network snapshot thread ───────────────
def _start_db_backup() -> None:
    """
    Flush WAL and copy the DB to a share every *DB_SNAPSHOT_SECS* seconds.
    Disable with VIDEO_DB_BACKUP_DISABLE=1.
    """
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
            except Exception as exc:  # pragma: no-cover
                log.warning("DB snapshot failed: %s", exc)
            time.sleep(interval)

    threading.Thread(target=_loop, daemon=True, name="db-backup").start()


_start_db_backup()

# ─────────────────────── 5. fancy FastAPI banner ────────────────────────
def _banner(app) -> None:
    from fastapi.routing import APIRoute
    from starlette.routing import Mount

    log.info("📚 Available endpoints:")
    for r in sorted(app.routes, key=lambda _r: getattr(_r, "path", "")):
        if isinstance(r, APIRoute) and getattr(r, "include_in_schema", True):
            methods = ",".join(m for m in r.methods if m not in ("HEAD", "OPTIONS"))
            log.info("  %-7s %s", methods, r.path)
        elif isinstance(r, Mount):
            continue


# ───────────────────── 6. server launcher helpers ───────────────────────
def _have_docker() -> bool:
    exe = shutil.which("docker")
    if not exe:
        return False
    try:
        subprocess.check_output([exe, "info"], stderr=subprocess.DEVNULL)
        return True
    except subprocess.CalledProcessError:
        return False


def start_server(
    host: str = "0.0.0.0",
    port: int = 8080,
    *,
    use_docker: Optional[bool] = None,
    **uvicorn_opts,
) -> None:
    """
    Entry-point used by `video.cli serve` **and** `python -m video`.

    1.  Prefer a host-level Docker container if available / requested.
    2.  Else run FastAPI + Uvicorn when installed.
    3.  Else fall back to the stdlib HTTP server in ``video.server``.
    """
    # 1️⃣  container on the host
    if use_docker is None:
        use_docker = os.getenv("VIDEO_USE_DOCKER") == "1" or _have_docker()

    if use_docker:
        image = os.getenv("VIDEO_DOCKER_IMAGE", "cdaprod/video:latest")
        cmd = ["docker", "run", "--rm",
               "-p", f"{port}:{port}",
               "-e", "VIDEO_FORCE_STDHTTP=0",
               image]
        log.info("🛳️  Launching host container: %s", " ".join(cmd))
        subprocess.run(cmd, check=True)
        return

    # 2️⃣  in-process FastAPI / Uvicorn
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

    # 3️⃣  std-lib fallback
    from video.server import serve
    serve(host=host, port=port)


# ─────────── 7. graceful shutdown / ^C hooks  (SIGTERM, atexit) ─────────
import video.lifecycle  # noqa: F401

# ───────────────────── 8. public re-exports ─────────────────────────────
__all__ = [
    "STORAGE",
    "DB",
    "start_server",
]