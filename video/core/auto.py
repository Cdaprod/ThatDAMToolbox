# /video/core/auto.py
"""
Auto-adapter that lets legacy code keep its old `DB.add_video`, `ingest_files`,
`HWAccelRecorder.stop_recording()`, … signatures while the actual work is
delegated to `video.core` (Artifact + BatchProcessor).

Just import `video.core.auto` *once* in the app’s bootstrap code.
"""

from __future__ import annotations
import functools, inspect, logging, types
from pathlib import Path
from typing import Any, List

_log = logging.getLogger("video.core.auto")

# ------------------------------------------------------------------ #
# 1.  Patch DB.add_video → call pipeline                             #
# ------------------------------------------------------------------ #
def _patch_media_db():
    try:
        from video import DB             # your singleton MediaDB
    except Exception:
        _log.debug("MediaDB not present – skip DB patches")
        return

    if hasattr(DB, "_auto_patched"):
        return                            # already done

    from video.core import ingest_folder, pipeline

    orig_add = DB.add_video

    @functools.wraps(orig_add)
    def add_video_proxy(self, path: str | Path, sha1: str, meta: dict | None = None):
        # Call the original so nothing breaks *during* migration
        orig_add(path=path, sha1=sha1, meta=meta)

        # Hand the file to the unified ingestion engine
        batch = ingest_folder(Path(path).parent, batch_name="legacy_scan")
        _log.info("auto-ingest → batch %s (file %s)", batch.id, path)

    DB.add_video = types.MethodType(add_video_proxy, DB)
    DB._auto_patched = True
    _log.info("MediaDB.add_video patched")

# ------------------------------------------------------------------ #
# 2.  Patch ingest_files() → pipeline.process_batch                  #
# ------------------------------------------------------------------ #
def _patch_ingest_files():
    try:
        from video import ingest as ingest_mod           # legacy module
    except ImportError:
        return

    if getattr(ingest_mod, "_auto_patched", False):
        return

    from video.core import ingest_folder

    def ingest_files_proxy(paths: List[str] | List[Path], *, batch_name: str | None):
        # Keep original behaviour (file moves, etc.)
        _log.debug("legacy ingest_files called for %d files", len(paths))
        res = ingest_mod.ingest_files_orig(paths, batch_name=batch_name)  # type: ignore

        # Delegate to new system
        parent_dirs = {Path(p).parent for p in paths}
        for d in parent_dirs:
            ingest_folder(str(d), batch_name=batch_name or "legacy_batch")

        return res

    ingest_mod.ingest_files_orig = ingest_mod.ingest_files   # backup
    ingest_mod.ingest_files      = ingest_files_proxy
    ingest_mod._auto_patched     = True
    _log.info("video.ingest.ingest_files patched")

# ------------------------------------------------------------------ #
# 3.  Patch HWAccelRecorder.stop_recording → pipeline                #
# ------------------------------------------------------------------ #
def _patch_hwcapture():
    try:
        from video.modules.hwcapture.hwcapture import HWAccelRecorder
    except Exception:
        return

    if hasattr(HWAccelRecorder, "_auto_patched"):
        return

    from video.core import ingest_folder

    orig_stop = HWAccelRecorder.stop_recording

    @functools.wraps(orig_stop)
    def stop_proxy(self, *a, **kw):
        orig_stop(self, *a, **kw)
        try:
            ingest_folder(Path(self.output_file).parent,
                          batch_name="hwcapture_session")
            _log.info("auto-ingest capture → %s", self.output_file)
        except Exception as e:
            _log.warning("auto-ingest failed: %s", e)

    HWAccelRecorder.stop_recording = stop_proxy
    HWAccelRecorder._auto_patched  = True
    _log.info("HWAccelRecorder.stop_recording patched")

# ------------------------------------------------------------------ #
# 4.  Run all patches once                                           #
# ------------------------------------------------------------------ #
def _init_auto():
    _patch_media_db()
    _patch_ingest_files()
    _patch_hwcapture()

_init_auto()