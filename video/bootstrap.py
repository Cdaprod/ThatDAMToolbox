"""Service bootstrap utilities.

This module exposes a :class:`Bootstrapper` that performs all expensive
initialisation (storage, event bus, plug‑in loading, background threads)
only when :func:`bootstrap` is invoked.  Importing this module has no
side effects, making it safe to use in tests.

Example
-------
    from video.bootstrap import bootstrap, start_server
    bootstrap()          # sets up storage and DB
    start_server()       # launch FastAPI with Uvicorn
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

from video.logging import configure_logging

log = logging.getLogger("video.bootstrap")


class Bootstrapper:
    """Initialise core services exactly once."""

    def __init__(self) -> None:
        self.storage = None
        self.db = None
        self._booted = False

    # public -----------------------------------------------------------------
    def run(self) -> None:
        """Perform all initialisation steps.  Idempotent."""
        if self._booted:
            return

        configure_logging()
        self._init_eventbus()
        self._init_storage()
        self._fix_permissions(Path("/var/lib/thatdamtoolbox/db"))
        self._fix_permissions(Path("/data"))
        self._load_plugins()
        import video.core.auto  # noqa: F401 (patches on import)
        self._start_db_backup()
        self._register_shutdown()
        self._booted = True

    # internals ---------------------------------------------------------------
    def _init_eventbus(self) -> None:
        try:
            from video.core.event import get_bus

            bus = get_bus()
            if bus is not None:
                log.info("EventBus: Initialized successfully")
            else:
                log.warning("EventBus: Initialization failed, continuing without event system")
        except ImportError:
            log.debug("EventBus: Optional dependency not available")
        except Exception as exc:  # pragma: no cover - defensive
            log.error("EventBus: Unexpected initialization error - %s", exc)

    def _init_storage(self) -> None:
        from video.storage.auto import AutoStorage
        from video.db import MediaDB

        self.storage = AutoStorage(os.getenv("VIDEO_STORAGE", "sqlite"))
        self.db = getattr(self.storage, "_db", None) or MediaDB()
        self.storage._db = self.db  # keep Storage + global in sync

    def _fix_permissions(self, target: Path) -> None:
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

    def _load_plugins(self) -> None:
        import pkgutil
        from video import modules

        for mod in pkgutil.iter_modules(modules.__path__, prefix="video.modules."):
            if mod.name.split(".")[-1].startswith("__"):
                continue
            importlib.import_module(mod.name)

    def _start_db_backup(self) -> None:
        if os.getenv("VIDEO_DB_BACKUP_DISABLE", "0") == "1":
            return

        interval = int(os.getenv("DB_SNAPSHOT_SECS", "300"))
        db_path = Path(os.getenv("VIDEO_DB_PATH", str(self.db.db_path)))
        backup_env = os.getenv("VIDEO_DB_BACKUP", "/data/db/media_index.sqlite3")
        backup_to = Path(backup_env)
        if backup_to.exists() and backup_to.is_dir():
            backup_to = backup_to / db_path.name
        elif backup_env.endswith(os.sep):
            backup_to = backup_to / db_path.name

        def _loop() -> None:
            while True:
                try:
                    with sqlite3.connect(db_path) as cx:
                        cx.execute("PRAGMA wal_checkpoint(TRUNCATE)")
                    tmp = backup_to.with_suffix(".tmp")
                    shutil.copy2(db_path, tmp)
                    tmp.replace(backup_to)
                    log.debug("DB snapshot → %s", backup_to)
                except Exception as exc:  # pragma: no cover - best effort
                    log.warning("DB snapshot failed: %r", exc)
                time.sleep(interval)

        threading.Thread(target=_loop, daemon=True, name="db-backup").start()

    def _register_shutdown(self) -> None:
        import video.lifecycle  # noqa: F401  (handles SIGTERM + atexit)

        def _publish_shutdown() -> None:
            try:
                from video.core.event import get_bus

                bus = get_bus()
                if bus:
                    bus.publish("videoapi.shutdown", {"ts": time.time()})
            except Exception:
                log.warning("Shutdown hook: failed to publish shutdown event")

        video.lifecycle.on_shutdown(_publish_shutdown)


_BOOTSTRAPPER = Bootstrapper()
STORAGE = None
DB = None


def bootstrap() -> None:
    """Initialise core services if not already done."""
    global STORAGE, DB
    _BOOTSTRAPPER.run()
    STORAGE = _BOOTSTRAPPER.storage
    DB = _BOOTSTRAPPER.db


# ---------------------------------------------------------------------------
# Server launcher helpers
# ---------------------------------------------------------------------------

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
    bootstrap()
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
        log.info("🛳️  Launching container: %s", " ".join(cmd))
        subprocess.run(cmd, check=True)
        return

    force_std = os.getenv("VIDEO_FORCE_STDHTTP") == "1"
    have_fast = _iu.find_spec("fastapi") is not None
    have_uci = _iu.find_spec("uvicorn") is not None

    if not force_std and have_fast and have_uci:
        import uvicorn
        from video.api.app import create_app

        app = create_app()
        _banner(app)
        workers = int(os.getenv("UVICORN_WORKERS", uvicorn_opts.pop("workers", "1")))
        if workers > 1 or uvicorn_opts.get("reload"):
            app_ref = "video.api.app:create_app"
            uvicorn.run(app_ref, host=host, port=port, workers=workers, factory=True, **uvicorn_opts)
        else:
            uvicorn.run(app, host=host, port=port, workers=workers, **uvicorn_opts)
        return

    from video.server import serve

    serve(host=host, port=port)


__all__ = ["STORAGE", "DB", "bootstrap", "start_server"]
