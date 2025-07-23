# SPDX-License-Identifier: MIT
# video/core/processor.py
"""
BatchProcessor – orchestrates the life-cycle of BatchArtifact instances.

Highlights
----------
* auto_group()     – smart bucketing helper (folder/date/camera/…).
* process_flat()   – one-liner: artefacts → batches → pipeline.
* Thread-safe      – internal state guarded by an RLock.
"""

from __future__ import annotations

import threading
from collections import defaultdict
from pathlib     import Path
from typing      import (
    Any, Callable, Dict, Iterable, List, Optional, Sequence,
)

from video.core.artifacts.base   import Artifact
from video.core.artifacts.video  import VideoArtifact
from video.core.artifacts.batch  import BatchArtifact


# ────────────────────────────────────────────────────────────────────────────
# Helper – bucket artefacts into batches                                     
# ────────────────────────────────────────────────────────────────────────────
def auto_group(
    artefacts: Iterable[Artifact],
    key_fn   : Callable[[Artifact], str] | None = None,
    *,
    batch_name_prefix: str = "batch",
) -> List[BatchArtifact]:
    """
    Slice an arbitrary artefact collection into batches.

    Parameters
    ----------
    artefacts
        Any iterable of `Artifact` (VideoArtifact, AudioArtifact, …).
    key_fn
        Function returning a *bucket key* for a given artefact.
        • Default: parent directory of the artefact’s `file_path`.
    batch_name_prefix
        Used when synthesising the `BatchArtifact.name`.

    Returns
    -------
    list[BatchArtifact]
    """
    if key_fn is None:
        key_fn = lambda a: str(Path(a.file_path).parent) if getattr(a, "file_path", None) else "ungrouped"

    buckets: Dict[str, BatchArtifact] = defaultdict(lambda: BatchArtifact(name=batch_name_prefix))

    for art in artefacts:
        buckets[key_fn(art)].add_video(art)      # add_video() works for any Artifact subclass

    # give deterministic names if the key is a path
    for k, batch in buckets.items():
        if batch.name == batch_name_prefix:
            batch.name = Path(k).name or k

    return list(buckets.values())


# ────────────────────────────────────────────────────────────────────────────
# Core processor                                                             
# ────────────────────────────────────────────────────────────────────────────
class BatchProcessor:
    """
    Drives a `BatchArtifact` through its full state machine:

        1. batch.start_processing()
        2. for each artefact → _process_video()
        3. batch.complete_video() / batch.fail_video()
        4. batch.finalize()
    """

    # Inject a custom per-video worker here if you need to
    VideoWorker = Callable[[VideoArtifact, Dict[str, Any]], Dict[str, Any]]

    def __init__(self, video_worker: VideoWorker | None = None):
        self._lock           = threading.RLock()
        self._active_batches: Dict[str, BatchArtifact] = {}
        self._video_worker   = video_worker or self._process_video

    # ── Public API ─────────────────────────────────────────────────────────
    def process_batch(self, batch: BatchArtifact) -> BatchArtifact:
        """
        Validate → iterate artefacts → finalise.

        Stores the batch in `self._active_batches` for later look-ups.
        """
        with self._lock:
            self._active_batches[batch.id] = batch

        if not batch.start_processing():
            return batch                      # invalid; nothing to do

        for vid in list(batch.videos):        # copy – list may mutate
            try:
                res = self._video_worker(vid, batch.config)
                batch.complete_video(vid, res)
            except Exception as exc:          # noqa: BLE001
                batch.fail_video(vid, str(exc))

        batch.finalize()
        return batch

    def process_flat(
        self,
        artefacts: Sequence[Artifact],
        *,
        key_fn : Callable[[Artifact], str] | None = None,
        prefix : str = "batch",
    ) -> List[BatchArtifact]:
        """
        One-liner: *artefacts* → `auto_group()` → `process_batch()`.

        Returns the list of fully-processed batches (order preserved).
        """
        batches = auto_group(artefacts, key_fn, batch_name_prefix=prefix)
        return [self.process_batch(b) for b in batches]

    def get_batch_status(self, batch_id: str) -> Optional[Dict[str, Any]]:
        """
        Return the serialised manifest for *any* in-memory batch.
        """
        with self._lock:
            batch = self._active_batches.get(batch_id)
            return batch.to_dict() if batch else None

    # ── Default per-video worker (replace with FFmpeg / ML etc.) ───────────
    @staticmethod
    def _process_video(video: VideoArtifact, cfg: Dict[str, Any]) -> Dict[str, Any]:
        """
        Mock implementation – swap in real work.

        Parameters
        ----------
        video : VideoArtifact
        cfg   : Dict from the parent BatchArtifact (encoding opts, …)

        Returns
        -------
        dict
            Arbitrary result payload fed back into `batch.complete_video()`.
        """
        ext   = cfg.get("format", "mp4")
        fps   = video.frame_rate or 0
        frames = int((video.duration or 0) * fps)

        return {
            "output_path": f"./outputs/{video.id}_processed.{ext}",
            "processing_time": 2.5,            # seconds – fake
            "inference_results": {
                "confidence": 0.95,
                "predictions": ["object1", "object2"],
                "frames_processed": frames,
            },
        }