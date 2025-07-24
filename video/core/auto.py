#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
video/core/auto.py

Bridges a few "old-world" entry-points into the new core pipeline while
remaining **idempotent** and tolerant of partially-initialised globals.

Patched once on import by video.bootstrap.
"""
from __future__ import annotations

import logging
from functools import wraps
from pathlib import Path
from typing import Sequence

log = logging.getLogger("video.core.auto")

# ───────────────────────── helpers ──────────────────────────────────────────
def _already(obj: object, flag: str = "_auto_patched") -> bool:
    return bool(getattr(obj, flag, False))


def _mark_done(obj: object, flag: str = "_auto_patched") -> None:
    setattr(obj, flag, True)


def _safe_patch(target: object, attr: str, build_wrapper):
    """Replace *target.attr* with wrapper produced by *build_wrapper*."""
    if not hasattr(target, attr):
        log.debug("skip patch – %s.%s missing", target, attr)
        return
    original = getattr(target, attr)

    @wraps(original)
    def wrapper(*a, **kw):
        return build_wrapper(original, *a, **kw)

    setattr(target, attr, wrapper)
    log.debug("✓ patched %s.%s", target, attr)


# Import lazily so we don’t create fresh DB instances in worker processes
from video.core.ingest import ingest_folder


# ─────────────── 1) MediaDB.add_video ───────────────────────────────────────
def _patch_media_db():
    from video import bootstrap as _bp          # lazy to avoid cycles
    DB = getattr(_bp, "DB", None)
    if DB is None:
        log.debug("DB singleton not yet ready – skipping add_video patch")
        return
    if _already(DB.__class__):
        return

    def _impl(orig, self, path: str | Path, sha1: str, meta: dict | None = None):
        # keep legacy behaviour
        orig(self, str(path), sha1, meta)
        # feed new pipeline (batch per parent dir)
        ingest_folder(Path(path).parent, batch_name="legacy_scan")
        return sha1

    _safe_patch(DB.__class__, "add_video", _impl)
    _mark_done(DB.__class__)
    log.info("✅ MediaDB.add_video patched")


# ─────────────── 2) ingest.ingest_files ─────────────────────────────────────
def _patch_legacy_ingest():
    try:
        from video import ingest as ing_mod
    except ImportError:
        return
    if _already(ing_mod):
        return

    def _impl(orig, paths: Sequence[str | Path], *, batch_name: str | None = None):
        res = orig(paths, batch_name=batch_name)
        for p in {Path(p).parent for p in paths}:
            ingest_folder(p, batch_name=batch_name or "legacy_batch")
        return res

    _safe_patch(ing_mod, "ingest_files", _impl)
    _mark_done(ing_mod)
    log.info("✅ ingest.ingest_files patched")


# ─────────────── 3) HWAccelRecorder.stop_recording ──────────────────────────
def _patch_hwcapture():
    try:
        from video.modules.hwcapture.hwcapture import HWAccelRecorder
    except Exception:
        return
    if _already(HWAccelRecorder):
        return

    def _impl(orig, self, *a, **kw):
        out = orig(self, *a, **kw)
        try:
            ingest_folder(Path(self.output_file).parent, batch_name="hwcapture")
        except Exception as exc:                 # pragma: no cover
            log.warning("auto-ingest after capture failed: %s", exc)
        return out

    _safe_patch(HWAccelRecorder, "stop_recording", _impl)
    _mark_done(HWAccelRecorder)
    log.info("✅ HWAccelRecorder.stop_recording patched")


# ─────────────── run all patches (idempotent) ───────────────────────────────
for _fn in (_patch_media_db, _patch_legacy_ingest, _patch_hwcapture):
    try:
        _fn()
    except Exception as exc:                     # pragma: no cover
        log.warning("%s failed: %s", _fn.__name__, exc)