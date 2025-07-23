## video/helpers/artifact_bridge.py
from pathlib import Path
from typing import Optional

from video.core.factory    import ArtifactFactory
from video.core.processor  import BatchProcessor
from video.core.artifacts.batch import BatchArtifact

# Use the same singleton pipeline
from video.core import pipeline

def index_folder_as_batch(
    folder: Path,
    batch_name: Optional[str] = None
) -> str:
    """
    1. Run the classic MediaIndexer scan() on `folder` (populates SQLite & previews).
    2. Build a BatchArtifact from that folder.
    3. Push it through the core.pipeline (BatchProcessor) to generate the full hierarchy.
    Returns the `batch.id` for later lookup via `video.core.get_manifest`.
    """
    # Step 1: filesystem scan + DB indexing
    from video import MediaIndexer
    idx = MediaIndexer()
    idx.scan(root_path=folder)

    # Step 2: build a BatchArtifact for the same folder
    batch: BatchArtifact = ArtifactFactory.create_batch_from_folder(
        str(folder),
        batch_name=batch_name
    )

    # Step 3: run through the core.pipeline
    pipeline.process_batch(batch)

    return batch.id