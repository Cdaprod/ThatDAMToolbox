"""
/video/core/event/types.py

Event type declarations and helper models
"""
from __future__ import annotations
import enum
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Mapping


class Topic(str, enum.Enum):
    """Well-known top-level topics used across the toolbox."""
    # capture-daemon ­­­> video-api
    CAPTURE_SEGMENT_CREATED = "capture.segment.created"
    CAPTURE_ERROR           = "capture.error"

    # video-api ­­­> UI / workers
    DAM_INGESTED            = "dam.ingested"
    DAM_FAILED              = "dam.failed"

    # service readiness events
    CAPTURE_SERVICE_UP      = "capture.service_up"
    VIDEO_API_SERVICE_UP    = "video.api.service_up"
    WEB_SERVICE_UP          = "web.service_up"

    # generic life-cycle
    LIFECYCLE_STARTUP       = "lifecycle.startup"
    LIFECYCLE_SHUTDOWN      = "lifecycle.shutdown"


@dataclass(slots=True)
class Event:
    """
    Minimal immutable event envelope.

    Use `payload` for arbitrary JSON-serialisable data.
    """
    topic:   Topic | str
    payload: Mapping[str, Any] = field(default_factory=dict)
    ts:      float             = field(default_factory=time.time)

    # --- convenience ---------------------------------------------------- #
    def to_dict(self) -> Dict[str, Any]:
        return {"topic": str(self.topic), "ts": self.ts, "payload": dict(self.payload)}

    @classmethod
    def from_dict(cls, d: Mapping[str, Any]) -> "Event":
        return cls(topic=d["topic"], ts=d.get("ts", time.time()), payload=d.get("payload", {}))