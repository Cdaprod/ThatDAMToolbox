#!/usr/bin/env python3
"""
video/api/modules.py

Auto-collect FastAPI routers in `video.api` **and** mount per-module static folders.

- Router discovery (non-invasive):
  • Scan sibling modules in video/api/*.py (excludes this file, app.py, etc.)
  • Scan subpackages; prefer <pkg>.router.router, fall back to package-level `router`
  • Only include real APIRouter instances; deterministic ordering

- Static mounts:
  • Uses video.paths.MODULE_PATH_REGISTRY = {module_name: {key: Path, ...}, ...}
  • Mounts each path at /modules/{module}/{key}
  • Adds a GET /modules/{module}/{key}/list endpoint that returns file names + URLs

Toggleable modules loader for `video.api`:

- VERSION=1 (legacy): only static mounts from MODULE_PATH_REGISTRY
- VERSION=2 (default): auto-collect APIRouter routers + static mounts
"""
from __future__ import annotations

import importlib, logging, os, pkgutil
from pathlib import Path
from typing import List

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles

try:
    from video.config import VIDEO_API_MODULES_VERSION
except Exception:
    VIDEO_API_MODULES_VERSION = os.getenv("VIDEO_API_MODULES_VERSION", "2")
    
from video.paths import MODULE_PATH_REGISTRY

log = logging.getLogger("video.api.modules")

# Public export consumed by app.py (safe in both versions)
routers: List[APIRouter] = []

# ---------------------------
# Router discovery (v2 only)
# ---------------------------
_PKG_NAME = __package__ or "video.api"
_THIS_DIR = Path(__file__).parent
_EXCLUDE_MODULES = {
    "__init__", "app", "modules", "bootstrap",
    "types", "models", "schemas", "config", "settings",
    "deps", "dependencies", "util", "utils", "logging",
    "version", "cli", "main",
}

def _collect_from_module(fqname: str) -> None:
    try:
        mod = importlib.import_module(fqname)
    except Exception as e:
        log.debug("Skip %s (import error): %s", fqname, e)
        return
    r = getattr(mod, "router", None)
    if isinstance(r, APIRouter):
        routers.append(r)
        log.info("Collected router from %s", fqname)
    elif r is not None:
        log.warning("Ignored non-APIRouter `router` in %s", fqname)

def _collect_from_package(name: str) -> None:
    pkg = f"{_PKG_NAME}.{name}"
    try:
        router_mod = importlib.import_module(f"{pkg}.router")
        r = getattr(router_mod, "router", None)
        if isinstance(r, APIRouter):
            routers.append(r)
            log.info("Collected router from %s.router", pkg)
            return
        elif r is not None:
            log.warning("Ignored non-APIRouter `router` in %s.router", pkg)
    except ModuleNotFoundError as e:
        if e.name != f"{pkg}.router":
            log.debug("Import issue in %s.router: %s", pkg, e)
    except Exception as e:
        log.debug("Error importing %s.router: %s", pkg, e)
    _collect_from_module(pkg)

def _discover() -> None:
    entries = []
    for _, name, ispkg in pkgutil.iter_modules([str(_THIS_DIR)]):
        if name.startswith("_") or name.startswith("test") or name in _EXCLUDE_MODULES:
            continue
        entries.append((name, ispkg))
    for name, ispkg in sorted(entries, key=lambda x: x[0]):
        _collect_from_package(name) if ispkg else _collect_from_module(f"{_PKG_NAME}.{name}")

# Run discovery only for v2
if VIDEO_API_MODULES_VERSION.strip() == "2":
    _discover()

# ---------------------------
# Static mounts (both)
# ---------------------------
def _make_list_handler(module_name: str, key: str):
    async def _list_module_assets():
        base = MODULE_PATH_REGISTRY[module_name][key]
        try:
            files = sorted(os.listdir(base))
        except FileNotFoundError:
            raise HTTPException(404, "Not found")
        return [{"filename": fn, "url": f"/modules/{module_name}/{key}/{fn}"} for fn in files]
    return _list_module_assets

def setup_module_static_mounts(app: FastAPI) -> None:
    for module_name, paths in MODULE_PATH_REGISTRY.items():
        for key, filesystem_path in paths.items():
            mount_path = f"/modules/{module_name}/{key}"
            app.mount(
                mount_path,
                StaticFiles(directory=str(filesystem_path), html=False),
                name=f"modules-{module_name}-{key}",
            )
            app.add_api_route(
                f"{mount_path}/list",
                _make_list_handler(module_name, key),
                methods=["GET"],
                name=f"list-{module_name}-{key}",
            )

def init_modules(app: FastAPI) -> None:
    # Include routers only on v2
    if VIDEO_API_MODULES_VERSION.strip() == "2":
        for r in routers:
            app.include_router(r)
    setup_module_static_mounts(app)
    log.info("video.api.modules initialized (VERSION=%s, routers=%d)", VIDEO_API_MODULES_VERSION, len(routers))

try:
    _v = VIDEO_API_MODULES_VERSION.strip()
except Exception:
    _v = "?"
log.info("modules.py: VERSION=%s, discovered_routers=%d", _v, len(routers))
for r in routers:
    # show prefixes to prove inclusion
    try:
        log.info("modules.py: router tags=%s prefix=%s", getattr(r, "tags", None), getattr(r, "prefix", None))
    except Exception:
        pass

__all__ = ["routers", "setup_module_static_mounts", "init_modules"]