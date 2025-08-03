#!/usr/bin/env python3
"""
/video/bootstrap.py

Central bootstrap – executed exactly once by *every* entry-point.

Sequence
────────
1.  Define helpers + `start_server` (plug-ins & CLI depend on it)
2.  Create `STORAGE` and guarantee `DB` ≠ None
3.  Fix volume permissions in containers
4.  Import every `video.modules.*` plug-in (registers routers / CLI verbs)
5.  Apply legacy monkey-patches (`video.core.auto`)
6.  Start WAL-checkpoint → snapshot thread
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

# ────────────────────────── logging ────────────────────────────
log = logging.getLogger("video.bootstrap")
log.setLevel(logging.INFO)

# ─────────────────────  helpers & server launcher ──────────────
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
    """Launch API – Docker ▸ Uvicorn ▸ stdlib."""
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

    from video.server import serve
    serve(host=host, port=port)
    


# ── Event Bus: Prod-grade initialization ─────────────────────
def _init_eventbus() -> None:
    """Initialize event bus with proper error handling."""
    try:
        from video.core.event import get_bus
        
        bus = get_bus()
        if bus is not None:
            log.info("EventBus: Initialized successfully")
        else:
            log.warning("EventBus: Initialization failed, continuing without event system")
            
    except ImportError:
        log.debug("EventBus: Optional dependency not available")
    except Exception as exc:
        log.error("EventBus: Unexpected initialization error - %s", exc)

# Initialize event bus - now properly handles all failure modes
_init_eventbus()


# ────────────────────────── 0. STORAGE / DB ────────────────────────
from video.storage.auto import AutoStorage  # lightweight import

STORAGE = AutoStorage(os.getenv("VIDEO_STORAGE", "sqlite"))

# Guarantee `DB` is a concrete MediaDB
_db_candidate = getattr(STORAGE, "_db", None)
if _db_candidate is None:
    from video.db import MediaDB
    _db_candidate = MediaDB()
    STORAGE._db = _db_candidate          # keep Storage + global in sync

DB = _db_candidate                        # public alias used everywhere

# ─────────── 1. container volume permission fix-up (optional) ──────
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

# ─────────── 2. load every plug-in (video.modules.*) ────────────────
def _load_plugins() -> None:
    import pkgutil
    from video import modules

    for mod in pkgutil.iter_modules(modules.__path__, prefix="video.modules."):
        if mod.name.split(".")[-1].startswith("__"):
            continue
        importlib.import_module(mod.name)


_load_plugins()

# ─────────── 3. legacy monkey-patches (needs DB) ────────────────────
import video.core.auto  # noqa: F401  (patches on import)

# ─────────── 4. WAL checkpoint → snapshot background thread ────────
def _start_db_backup() -> None:
    if os.getenv("VIDEO_DB_BACKUP_DISABLE", "0") == "1":
        return

    interval  = int(os.getenv("DB_SNAPSHOT_SECS", "300"))
    db_path   = Path(os.getenv("VIDEO_DB_PATH", str(DB.db_path)))
    backup_env = os.getenv("VIDEO_DB_BACKUP", "/data/db/media_index.sqlite3")
    backup_to = Path(backup_env)

    # If backup_to is a directory (or ends with a separator), append db file name
    if backup_to.exists() and backup_to.is_dir():
        backup_to = backup_to / db_path.name
    elif backup_env.endswith(os.sep):
        backup_to = backup_to / db_path.name

    def _loop() -> None:
        while True:
            try:
                # Force WAL checkpoint
                with sqlite3.connect(db_path) as cx:
                    cx.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                # Copy database to a temporary file, then atomically replace backup
                tmp = backup_to.with_suffix(".tmp")
                shutil.copy2(db_path, tmp)
                tmp.replace(backup_to)
                log.debug("DB snapshot → %s", backup_to)
            except Exception as exc:
                log.warning("DB snapshot failed: %r", exc)
            time.sleep(interval)

    threading.Thread(target=_loop, daemon=True, name="db-backup").start()


_start_db_backup()


# ─────────── 5. graceful shutdown hooks ─────────────────────────────
import video.lifecycle  # noqa: F401  (handles SIGTERM + atexit)

# ── define our shutdown publisher ─────────────────────────────────────
def _publish_shutdown() -> None:
    """
    Called on SIGINT/SIGTERM or normal exit.
    Publishes a simple shutdown event to your broker.
    """
    try:
        # adjust to your broker API if needed
        from video.core.event import get_bus
        bus = get_bus()
        if bus:
            bus.publish("videoapi.shutdown", {"ts": time.time()})
    except Exception:
        log.warning("Shutdown hook: failed to publish shutdown event")


video.lifecycle.on_shutdown(_publish_shutdown)   # register once

# ─────────── 6. public symbols ──────────────────────────────────────
__all__ = [
    "STORAGE",
    "DB",
    "start_server",
]