# app/core/facades/video_facade.py
from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Dict, Any
from video.core.artifacts.video import VideoArtifact
from video.core.proxy.media_proxy import MediaProxyArtifact

class VideoFacade(BaseModel):
    artifact: VideoArtifact
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "allow", "arbitrary_types_allowed": True}

    # passthrough access
    def __getitem__(self, item):
        return self.metadata.get(item) or getattr(self.artifact, item, None)

    # API helpers
    def to_proxy(self) -> MediaProxyArtifact:
        return MediaProxyArtifact(
            id=self.artifact.id,
            filename=self.artifact.filename,
            source_type=self.artifact.source_type,
            created_at=self.artifact.created_at,
            state=self.artifact.state.value,
            file_path=self.artifact.file_path,
            duration=self.artifact.duration,
            resolution=list(self.artifact.resolution) if self.artifact.resolution else None,
            codec=self.artifact.codec,
            bitrate=self.artifact.bitrate,
            frame_rate=self.artifact.frame_rate,
            metadata={**self.artifact.metadata, **self.metadata},
            events=[e.__dict__ for e in self.artifact.events],
        )