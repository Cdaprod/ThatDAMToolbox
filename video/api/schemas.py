"""Pydantic models used by the API layer."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field

from video.helpers import model_validator


class BatchUpsertRequest(BaseModel):
    paths: Optional[List[str]] = Field(
        default=None, description="Explicit media files to ingest"
    )
    folder: Optional[str] = Field(
        default=None, description="Scan this folder recursively"
    )
    name: Optional[str] = None

    @model_validator(mode="after")
    def _exactly_one_source(self):  # type: ignore[override]
        if bool(self.paths) ^ bool(self.folder):
            return self
        raise ValueError("Provide *either* paths[] *or* folder, not both")


class CLIRequest(BaseModel):
    """Arbitrary CLI step; must include an 'action' key."""

    action: str
    params: Dict[str, Any] = {}
