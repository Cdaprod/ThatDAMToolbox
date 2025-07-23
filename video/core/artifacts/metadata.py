# video/core/artifacts/metadata.py
# SPDX-License-Identifier: MIT
"""
Composable, Pydantic-powered metadata fragments.
…
"""
from __future__ import annotations
from datetime import datetime
from typing import Any, Dict, List, Tuple

from pydantic import BaseModel, Field

class MetaBase(BaseModel):
    class Config:
        extra = "allow"
        orm_mode = True
        json_encoders = {set: list}

# ── fragments ──────────────────────────────────────────────────────────── #
class TechMeta(MetaBase):
    duration   : float | None = None
    resolution : Tuple[int, int] | None = None
    codec      : str  | None = None
    bitrate    : int  | None = None
    frame_rate : float| None = None

class ImageMeta(MetaBase):
    datetime_original : datetime | None = None
    camera_make       : str      | None = None
    camera_model      : str      | None = None
    orientation       : int      | None = None
    keywords          : List[str]      = Field(default_factory=list)

class ProcessingMeta(MetaBase):
    processed_at : datetime | None = None
    worker_id    : str      | None = None
    notes        : Dict[str, Any] = Field(default_factory=dict)

__all__ = ["MetaBase", "TechMeta", "ImageMeta", "ProcessingMeta"]