# SPDX-License-Identifier: MIT
# video/core/facades/video_facade.py
from __future__ import annotations

from typing import Any, Dict

from pydantic import BaseModel, Field

from video.core.artifacts.video import VideoArtifact
from video.core.proxy import MediaProxyArtifact


class VideoFacade(BaseModel):
    """
    Lightweight adapter around :class:`VideoArtifact`.

    Adds arbitrary per-request `metadata` **without touching** the immutable
    artefact and provides a `to_proxy()` helper for API serialisation.
    """

    artifact: VideoArtifact
    metadata: Dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "allow", "arbitrary_types_allowed": True}

    # --------------------------------------------------------------------- #
    # Passthrough sugar – behaves a bit like a dict/attr hybrid
    # --------------------------------------------------------------------- #
    def __getitem__(self, item: str) -> Any:          # dunder [] access
        return self.metadata.get(item) or getattr(self.artifact, item, None)

    def __getattr__(self, item: str) -> Any:          # dot access passthrough
        try:
            return self.metadata[item]
        except KeyError:
            return getattr(self.artifact, item)

    # --------------------------------------------------------------------- #
    # API helpers
    # --------------------------------------------------------------------- #
    def to_proxy(self) -> MediaProxyArtifact:
        """Return a flattened view suitable for JSON responses."""
        a = self.artifact
        return MediaProxyArtifact(
            id=a.id,
            filename=a.filename,
            source_type=a.source_type,
            created_at=a.created_at,
            state=a.state.value,
            file_path=a.file_path,
            duration=a.duration,
            resolution=list(a.resolution) if a.resolution else None,
            codec=a.codec,
            bitrate=a.bitrate,
            frame_rate=a.frame_rate,
            metadata={**a.metadata, **self.metadata},
            events=[e.model_dump() for e in a.events],
        )