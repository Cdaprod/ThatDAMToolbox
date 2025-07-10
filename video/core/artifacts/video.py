# /video/core/artifacts/video.py
from __future__ import annotations
import hashlib
import json
from dataclasses import asdict
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, Tuple

from .base import Artifact, ArtifactState, ArtifactEventType
from pydantic.dataclasses import dataclass

@dataclass
class VideoArtifact(Artifact):
    filename: str = ""
    source_type: str = ""
    file_path: Optional[str] = None
    file_hash: Optional[str] = None
    duration: Optional[float] = None
    resolution: Optional[Tuple[int, int]] = None
    codec: Optional[str] = None
    bitrate: Optional[int] = None
    frame_rate: Optional[float] = None
    processing_results: Dict[str, Any] = None

    def __post_init__(self):
        super().__post_init__()
        if self.processing_results is None:
            self.processing_results = {}
        self.emit(ArtifactEventType.CREATED, {
            "filename": self.filename,
            "source_type": self.source_type
        })

    def set_source_data(self, *, file_path: Optional[str] = None, file_data: Optional[bytes] = None):
        if file_path:
            self.file_path = file_path
            self.file_hash = self._hash_file(file_path)
            self.emit(ArtifactEventType.SOURCE_ATTACHED, {"file_path": file_path, "hash": self.file_hash})
        elif file_data:
            self.file_hash = self._hash_bytes(file_data)
            self.emit(ArtifactEventType.DATA_ATTACHED, {"bytes": len(file_data), "hash": self.file_hash})

    def extract_metadata(self):
        # Placeholder: real ffprobe logic can go here
        self.duration = 120.5
        self.resolution = (1920, 1080)
        self.codec = "h264"
        self.bitrate = 5_000_000
        self.frame_rate = 30.0
        self.emit(ArtifactEventType.METADATA_EXTRACTED, {
            "duration": self.duration,
            "resolution": self.resolution,
            "codec": self.codec,
        })

    def validate(self) -> bool:
        if not self.filename:
            return False
        if self.file_path and not Path(self.file_path).exists():
            return False
        self.state = ArtifactState.VALIDATED
        self.emit(ArtifactEventType.VALIDATED, {"hash": self.file_hash})
        return True

    def to_dict(self, exclude_none: bool = True) -> Dict[str, Any]:
        """
        Serialize to a plain dict. By default, omits None values.
        """
        # Try Pydantic’s .dict() if available
        try:
            return self.dict(by_alias=True, exclude_none=exclude_none)
        except Exception:
            # Fallback for plain dataclasses
            data = asdict(self)
            if exclude_none:
                data = {k: v for k, v in data.items() if v is not None}
            # Convert JSON-unfriendly types
            for k, v in data.items():
                if isinstance(v, Path):
                    data[k] = str(v)
                elif isinstance(v, datetime):
                    data[k] = v.isoformat()
                elif isinstance(v, tuple):
                    data[k] = list(v)
            return data

    def to_json(self, *, exclude_none: bool = True, **kwargs) -> str:
        """
        Dump to JSON string. Uses default=str to handle any remaining non-serializable values.
        """
        return json.dumps(self.to_dict(exclude_none=exclude_none), default=str, **kwargs)

    # ---- Private helpers ----
    def _hash_file(self, path: str) -> str:
        sha256 = hashlib.sha256()
        with open(path, "rb") as fh:
            for chunk in iter(lambda: fh.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _hash_bytes(self, data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    # ---- Event reducer ----
    def _apply(self, event):
        if event.type == ArtifactEventType.PROCESSING_STARTED:
            self.state = ArtifactState.PROCESSING
        elif event.type == ArtifactEventType.PROCESSING_COMPLETED:
            self.state = ArtifactState.COMPLETED
            self.processing_results.update(event.data or {})
        elif event.type == ArtifactEventType.PROCESSING_FAILED:
            self.state = ArtifactState.FAILED