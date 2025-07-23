# video/core/__init__.py
# SPDX-License-Identifier: MIT
"""
──────────────────────────────────────────────────────────────────────────────
🎬  video.core -- public façade around the *Artifact* processing pipeline
──────────────────────────────────────────────────────────────────────────────
This module is the **only** place external code should import from when it
needs to push media through the back-end or query live batch status.

Why a façade?
    * **Single surface** – callers never touch internal classes directly.
    * **Encapsulation** – implementation details stay swappable.
    * **Singleton pipeline** (`pipeline`) is created once and reused everywhere
      (important for FastAPI multi-worker deployments).

Typical flow
    >>> from video.core import ingest_uploads, get_manifest
    >>> batch   = ingest_uploads(uploads=request.files, config=user_cfg)
    >>> current = get_manifest(batch.id)
Public helpers
    • ingest_uploads   – handle raw "multipart/form-data" style payloads
    • ingest_folder    – ingest an existing on-disk folder
    • ingest_cli       – convenience wrapper for argparse scripts
    • get_manifest     – inspect a batch (queued, running, finished)
    • pipeline         – escape hatch: the singleton BatchProcessor
"""
from __future__ import annotations

import os
from typing import Any, Dict, List, Optional, Sequence, overload

from .artifacts.batch import BatchArtifact
from .factory import ArtifactFactory
from .processor import BatchProcessor

__all__ = [
    "ingest_uploads",
    "ingest_folder",
    "ingest_cli",
    "get_manifest",
    "pipeline",
]

# ── singleton pipeline (cheap but we really only want one) ───────────────────
pipeline: BatchProcessor = BatchProcessor()

# ── façade helpers ───────────────────────────────────────────────────────────

@overload
def ingest_uploads(
    *, uploads: List[Dict[str, Any]], config: Dict[str, Any]
) -> BatchArtifact: ...
@overload
def ingest_uploads(
    *,
    uploads: List[Dict[str, Any]],
    config: Dict[str, Any],
    request_metadata: Dict[str, Any] | None,
) -> BatchArtifact: ...

def ingest_uploads(
    *,
    uploads: List[Dict[str, Any]],
    config: Dict[str, Any],
    request_metadata: Optional[Dict[str, Any]] = None,
) -> BatchArtifact:
    """Push a raw uploads payload through the processing pipeline."""
    batch = ArtifactFactory.create_batch_from_api(
        uploads, config, request_metadata=request_metadata
    )
    return pipeline.process_batch(batch)

def ingest_folder(
    folder: str | os.PathLike[str],
    *,
    batch_name: str | None = None,
    config: Optional[Dict[str, Any]] = None,
) -> BatchArtifact:
    """Sweep *folder* for media files and process them as a single batch."""
    batch = ArtifactFactory.create_batch_from_folder(folder, batch_name)
    if config:
        batch.metadata.setdefault("config", {}).update(config)
    return pipeline.process_batch(batch)

def ingest_cli(
    args: Any,
    paths: Sequence[str | os.PathLike[str]],
) -> BatchArtifact:
    """Tiny shim for CLI entry-points – keeps argparse glue out of core logic."""
    batch = ArtifactFactory.create_batch_from_cli(args, list(map(str, paths)))
    return pipeline.process_batch(batch)

def get_manifest(batch_id: str) -> Optional[Dict[str, Any]]:
    """Return the immutable manifest for any batch ID (or *None* if unknown)."""
    return pipeline.get_batch_status(batch_id)