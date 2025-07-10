"""
video.core  ── High-level façade for the Artifact pipeline
========================================================

Typical usage
-------------
from video.core import (
    ingest_uploads, ingest_folder,
    get_manifest, pipeline         # the singleton if you need more control
)

batch = ingest_uploads(uploads=payload, config=user_cfg)
status = get_manifest(batch.id)

Design notes
------------
*  This file plays the **Controller / Facade** role: a single import
   surface for creating, processing, and querying batches.
*  Internally we own a _single_ BatchProcessor instance (`pipeline`)
   so stateful batch look-ups & streaming progress work everywhere.
*  Pure functions defer to ArtifactFactory + BatchProcessor;
   no business logic lives here, keeping SRP intact.
"""
from __future__ import annotations

from typing import List, Dict, Any, Optional

from .factory import ArtifactFactory
from .processor import BatchProcessor
from .artifacts.batch import BatchArtifact

# --------------------------------------------------------------------------- #
# Singleton pipeline (thread-safe in typical async / uvicorn worker scenarios)
# --------------------------------------------------------------------------- #
pipeline: BatchProcessor = BatchProcessor()

# --------------------------------------------------------------------------- #
# Convenience 1-liners ––––– the "controller methods"                        #
# --------------------------------------------------------------------------- #
def ingest_uploads(
    uploads: List[Dict[str, Any]],
    config: Dict[str, Any],
    request_metadata: Optional[Dict[str, Any]] = None,
) -> BatchArtifact:
    """
    Create a BatchArtifact from raw upload payloads (+ optional request metadata),
    push the batch through the processing pipeline, return the enriched BatchArtifact.
    """
    batch = ArtifactFactory.create_batch_from_api(uploads, config, request_metadata)
    return pipeline.process_batch(batch)


def ingest_folder(
    folder: str,
    *,
    batch_name: Optional[str] = None,
    config: Optional[Dict[str, Any]] = None,
) -> BatchArtifact:
    """
    Quickly sweep a local directory for video files, produce a batch,
    then execute the full processing lifecycle.
    """
    batch = ArtifactFactory.create_batch_from_folder(folder, batch_name)
    if config:
        # allow the caller to inject/override config options detected downstream
        batch.metadata["config"] = config
    return pipeline.process_batch(batch)


def ingest_cli(args: Any, paths: List[str]) -> BatchArtifact:
    """
    Convenience wrapper for CLI entry-points – keeps the command script tiny.
    """
    batch = ArtifactFactory.create_batch_from_cli(args, paths)
    return pipeline.process_batch(batch)


# --------------------------------------------------------------------------- #
# Read-only helpers                                                           #
# --------------------------------------------------------------------------- #
def get_manifest(batch_id: str) -> Optional[Dict[str, Any]]:
    """
    Return the canonical `to_dict()` manifest for *any* batch the singleton
    has seen – in-flight or completed.  Returns None if unknown.
    """
    return pipeline.get_batch_status(batch_id)