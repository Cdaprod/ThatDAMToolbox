# SPDX-License-Identifier: MIT
# video/core/proxy/media_proxy.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class MediaProxyArtifact(BaseModel):
    """
    Flat, JSON-friendly view of a :class:`~video.core.artifacts.video.VideoArtifact`.

    *Keep this class 100 % dependency-free* (only stdlib + Pydantic) so it can be
    imported by FastAPI response models, Celery workers, etc. without dragging
    heavy CV / FFmpeg libs into processes that don’t need them.
    """

    id: str
    filename: str
    source_type: str
    created_at: datetime
    state: str

    # optional tech-metadata (omitted when unknown)
    file_path: Optional[str] = None
    duration: Optional[float] = None
    resolution: Optional[List[int]] = None          # [w, h]
    codec: Optional[str] = None
    bitrate: Optional[int] = None
    frame_rate: Optional[float] = None

    # free-form JSON blobs
    metadata: Dict[str, Any] = {}
    events:   List[Dict[str, Any]] = []

    model_config = ConfigDict(from_attributes=True)