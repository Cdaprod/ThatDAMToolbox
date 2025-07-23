
"""
video/core/auto.py
SPDX-License-Identifier: MIT
──────────────────────────────────────────────────────────────────────────────
Legacy-bridge helpers
──────────────────────────────────────────────────────────────────────────────
This module hot-patches a few "old world" entry-points so they quietly delegate
to the new *video.core* pipeline without breaking existing code:

    •  MediaDB.add_video(...)
    •  video.ingest.ingest_files(...)
    •  HWAccelRecorder.stop_recording(...)

Import *once* during bootstrap – nothing will happen on subsequent imports
(idempotent guards are built-in).
"""
from __future__ import annotations

import functools
import logging
import types
from pathlib import Path
from typing import Iterable, List, Sequence

_log = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# helpers
# ─────────────────────────────────────────────────────────────────────────────
def _already(flag_owner: object, flag: str) -> bool:
    """Return True if *flag_owner* already has *flag* set to True."""
    return bool(getattr(flag_owner, flag, False))


def _mark_done(flag_owner: object, flag: str = "_auto_patched") -> None:
    setattr(flag_owner, flag, True)


# ─────────────────────────────────────────────────────────────────────────────
# 1)  MediaDB.add_video  → core.ingest_folder
# ─────────────────────────────────────────────────────────────────────────────
def _patch_media_db() -> None:
    try:
        from video import DB  # singleton MediaDB, created lazily by video.__init__
    except Exception:
        _log.debug("MediaDB not importable – skipping DB patch")
        return

    if _already(DB, "_auto_patched"):
        return

    from video.core import ingest_folder  # local import avoids early side-effects

    original_add = DB.add_video  # type: ignore[attr-defined]

    @functools.wraps(original_add)
    def _add_video_proxy(self, path: str | Path, sha1: str, meta: dict | None = None):
        original_add(path=path, sha1=sha1, meta=meta)                 # keep legacy side-effects
        batch = ingest_folder(Path(path).parent, batch_name="legacy_scan")
        _log.info("MediaDB.add_video → routed into pipeline (batch=%s)", batch.id)

    DB.add_video = types.MethodType(_add_video_proxy, DB)  # type: ignore[assignment]
    _mark_done(DB)
    _log.info("✅  MediaDB.add_video patched")


# ─────────────────────────────────────────────────────────────────────────────
# 2)  ingest_files(...)  → core.ingest_folder
# ─────────────────────────────────────────────────────────────────────────────
def _patch_legacy_ingest() -> None:
    try:
        from video import ingest as ingest_mod
    except Exception:
        _log.debug("video.ingest not importable – skipping ingest_files patch")
        return

    if _already(ingest_mod):
        return

    from video.core import ingest_folder  # local import

    ingest_mod.ingest_files_orig = ingest_mod.ingest_files  # type: ignore[attr-defined]

    def _proxy(paths: Sequence[str | Path], *, batch_name: str | None):
        _log.debug("legacy ingest_files(%d paths) intercepted", len(paths))
        res = ingest_mod.ingest_files_orig(paths, batch_name=batch_name)  # type: ignore[arg-type]

        # also run the modern pipeline once per *parent* directory
        for parent in {Path(p).parent for p in paths}:
            ingest_folder(str(parent), batch_name=batch_name or "legacy_batch")
        return res

    ingest_mod.ingest_files = _proxy  # type: ignore[assignment]
    _mark_done(ingest_mod)
    _log.info("✅  video.ingest.ingest_files patched")


# ─────────────────────────────────────────────────────────────────────────────
# 3)  HWAccelRecorder.stop_recording  → pipeline ingest
# ─────────────────────────────────────────────────────────────────────────────
def _patch_hwcapture() -> None:
    try:
        from video.modules.hwcapture.hwcapture import HWAccelRecorder
    except Exception:
        _log.debug("hwcapture module absent – skipping HWAccelRecorder patch")
        return

    if _already(HWAccelRecorder):
        return

    from video.core import ingest_folder

    original_stop = HWAccelRecorder.stop_recording

    @functools.wraps(original_stop)
    def _stop_proxy(self, *args, **kwargs):
        original_stop(self, *args, **kwargs)
        try:
            ingest_folder(Path(self.output_file).parent, batch_name="hwcapture_session")
            _log.info("HW capture auto-ingested → %s", self.output_file)
        except Exception as exc:  # pragma: no-cover
            _log.warning("auto-ingest after HW capture failed: %s", exc)

    HWAccelRecorder.stop_recording = _stop_proxy  # type: ignore[assignment]
    _mark_done(HWAccelRecorder)
    _log.info("✅  HWAccelRecorder.stop_recording patched")


# ─────────────────────────────────────────────────────────────────────────────
# initialise once at import time
# ─────────────────────────────────────────────────────────────────────────────
def _run_all_patches() -> None:
    _patch_media_db()
    _patch_legacy_ingest()
    _patch_hwcapture()


_run_all_patches()