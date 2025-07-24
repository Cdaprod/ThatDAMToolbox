#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
video/core/auto.py
──────────────────────────────────────────────────────────────────────────────
Hot-patch legacy helpers so old code keeps working after the core refactor.

Patched on import by *video.bootstrap* (idempotent).

Patches applied
───────────────
1. MediaDB.add_video(...)          → funnels through new core factory
2. ingest.ingest_files(...)        → also calls new pipeline
3. HWAccelRecorder.stop_recording  → ingests recording directory
"""
from __future__ import annotations

import logging
from functools import wraps
from pathlib import Path
from typing import Callable, Sequence

log = logging.getLogger("video.core.auto")

# ───────────────────────── helpers ──────────────────────────────────────────
def _already(flag_owner: object, flag: str = "_auto_patched") -> bool:
    """Return **True** if *flag_owner* already carries the marker flag."""
    return bool(getattr(flag_owner, flag, False))


def _mark_done(flag_owner: object, flag: str = "_auto_patched") -> None:
    """Set a marker so we never patch the same object twice."""
    setattr(flag_owner, flag, True)


def _safe_patch(target: object, attr: str, build_wrapper: Callable) -> None:
    """
    Replace *target.attr* with a wrapper returned by *build_wrapper*.

    • Silently skips if the attribute is missing.
    • Logs successes and "skipped" cases.
    """
    if not hasattr(target, attr):
        log.debug("skip patch – %s.%s not found", target, attr)
        return

    original = getattr(target, attr)

    @wraps(original)
    def wrapper(*a, **kw):
        return build_wrapper(original, *a, **kw)

    setattr(target, attr, wrapper)
    log.debug("✓ patched %s.%s", target, attr)


# ─────────────────────── patch #1 – MediaDB.add_video ───────────────────────
def _patch_media_db() -> None:
    from video import bootstrap as _bootstrap

    DB = _bootstrap.DB
    if DB is None or _already(DB.__class__):
        return

    from video.core.factory import create_from_path

    def _impl(orig, self, path: str | Path, sha1: str, meta: dict | None = None):
        orig(self, str(path), sha1, meta)           # legacy behaviour
        create_from_path(Path(path))                # new pipeline
        return sha1

    _safe_patch(DB.__class__, "add_video", _impl)
    _mark_done(DB.__class__)
    log.info("✅ MediaDB.add_video patched")


# ───────────────────── patch #2 – ingest.ingest_files ───────────────────────
def _patch_legacy_ingest() -> None:
    try:
        from video import ingest as _ingest_mod
    except ImportError:
        return
    if _already(_ingest_mod):
        return

    from video.core.factory import create_from_path

    def _impl(orig, paths: Sequence[str | Path], *, batch_name: str | None = None):
        res = orig(paths, batch_name=batch_name)    # keep original return
        for parent in {Path(p).parent for p in paths}:
            create_from_path(parent)
        return res

    _safe_patch(_ingest_mod, "ingest_files", _impl)
    _mark_done(_ingest_mod)
    log.info("✅ ingest.ingest_files patched")


# ─────────────── patch #3 – HWAccelRecorder.stop_recording ──────────────────
def _patch_hwcapture() -> None:
    try:
        from video.modules.hwcapture.hwcapture import HWAccelRecorder
    except Exception:
        return
    if _already(HWAccelRecorder):
        return

    from video.core.factory import create_from_path

    def _impl(orig, self, *a, **kw):
        out = orig(self, *a, **kw)
        try:
            create_from_path(Path(self.output_file).parent)
        except Exception as exc:          # pragma: no cover
            log.warning("auto-ingest after capture failed: %s", exc)
        return out

    _safe_patch(HWAccelRecorder, "stop_recording", _impl)
    _mark_done(HWAccelRecorder)
    log.info("✅ HWAccelRecorder.stop_recording patched")


# ───────────────────────── run all patches once ─────────────────────────────
for _fn in (_patch_media_db, _patch_legacy_ingest, _patch_hwcapture):
    try:
        _fn()
    except Exception as exc:              # pragma: no cover
        log.warning("%s failed: %s", _fn.__name__, exc)