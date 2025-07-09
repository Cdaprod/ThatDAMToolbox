# app/core/artifacts/batch.py

from __future__ import annotations
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic.dataclasses import dataclass

from .base import Artifact, ArtifactState, ArtifactEventType
from .video import VideoArtifact  # if you ever want to embed VideoArtifacts directly

@dataclass
class BatchArtifact(Artifact):
    """
    Represents a group of VideoArtifact (or any Artifact) for collective processing.
    Tracks lifecycle, events, and allows you to serialize a manifest.
    """
    name: str = ""
    videos: List[VideoArtifact] = None
    config: Dict[str, Any] = None
    results: Dict[str, Any] = None
    source_interface: Optional[str] = None
    total_videos: int = 0
    processed_videos: int = 0
    failed_videos: int = 0
    processing_time: Optional[float] = None

    def __post_init__(self):
        super().__post_init__()
        self.videos = self.videos or []
        self.config = self.config or {}
        self.results = self.results or {}
        # Emit a creation event
        self.emit(ArtifactEventType.CREATED, {"name": self.name})

    def add_video(self, video: VideoArtifact) -> None:
        """
        Add a VideoArtifact (or any Artifact) to this batch.
        Automatically increments counters and emits an event.
        """
        self.videos.append(video)
        self.total_videos += 1
        self.emit(
            ArtifactEventType.SOURCE_ATTACHED,
            {"video_id": video.id, "filename": video.filename}
        )

    def start_processing(self) -> bool:
        """
        Validate the batch, mark as processing, and emit an event.
        Returns False if validation fails.
        """
        # simple validation: must have at least one video
        if not self.videos:
            return False

        self.state = ArtifactState.PROCESSING
        self.emit(
            ArtifactEventType.PROCESSING_STARTED,
            {"total_videos": self.total_videos, "config": self.config}
        )
        return True

    def complete_video(self, video: VideoArtifact, results: Dict[str, Any]) -> None:
        """
        Report one video finished processing.
        """
        self.processed_videos += 1
        self.emit(
            ArtifactEventType.PROCESSING_COMPLETED,
            {"video_id": video.id, **results}
        )

    def fail_video(self, video: VideoArtifact, error: str) -> None:
        """
        Report one video failed processing.
        """
        self.failed_videos += 1
        self.emit(
            ArtifactEventType.PROCESSING_FAILED,
            {"video_id": video.id, "error": error}
        )

    def finalize(self) -> None:
        """
        Called after all videos are done to mark the batch completed.
        """
        self.state = ArtifactState.COMPLETED
        self.results = {
            "total": self.total_videos,
            "processed": self.processed_videos,
            "failed": self.failed_videos,
            "success_rate": (
                self.processed_videos / self.total_videos if self.total_videos else 0
            )
        }
        self.emit(ArtifactEventType.PROCESSING_COMPLETED, self.results)

    def validate(self) -> bool:
        """
        Optionally re-validate the entire batch.
        Here we just check that each child artifact is valid.
        """
        for v in self.videos:
            if not v.validate():
                return False
        self.state = ArtifactState.VALIDATED
        self.emit(ArtifactEventType.VALIDATED, {"video_count": self.total_videos})
        return True

    def to_dict(self) -> Dict[str, Any]:
        """
        Serialize the batch manifest (for saving to JSON, etc).
        """
        return {
            "id": self.id,
            "name": self.name,
            "state": self.state.value,
            "created_at": self.created_at.isoformat(),
            "version": self.version,
            "total_videos": self.total_videos,
            "processed_videos": self.processed_videos,
            "failed_videos": self.failed_videos,
            "processing_time": self.processing_time,
            "config": self.config,
            "results": self.results,
            "videos": [v.to_dict() for v in self.videos],
            "events": [e.__dict__ for e in self.events],
        }

    def _apply(self, event: ArtifactEvent) -> None:
        """
        Handle internal state transitions based on events.
        (Overrides the no-op in base.Artifact.)
        """
        if event.type == ArtifactEventType.PROCESSING_STARTED:
            self.state = ArtifactState.PROCESSING
        elif event.type == ArtifactEventType.PROCESSING_COMPLETED and self.processed_videos + self.failed_videos == self.total_videos:
            # if all videos done, finalize
            self.state = ArtifactState.COMPLETED
        elif event.type == ArtifactEventType.PROCESSING_FAILED:
            self.state = ArtifactState.FAILED
            
    def save_manifest(self, output_dir: str) -> str:
        """Serialize to JSON file and return the path."""
        path = Path(output_dir) / f"{self.id}_manifest.json"
        path.write_text(json.dumps(self.to_dict(), indent=2))
        return str(path)