from __future__ import annotations
import hashlib
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

from .base import Artifact, ArtifactState, ArtifactEventType
from pydantic.dataclasses import dataclass

@dataclass
class AudioArtifact(Artifact):
    filename: str = ""
    source_type: str = ""
    file_path: Optional[str] = None
    file_hash: Optional[str] = None
    duration: Optional[float] = None
    codec: Optional[str] = None
    bitrate: Optional[int] = None
    sample_rate: Optional[int] = None
    channels: Optional[int] = None
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
        # Placeholder: real audio probing logic
        self.duration = 215.0
        self.codec = "aac"
        self.bitrate = 192_000
        self.sample_rate = 44100
        self.channels = 2
        self.emit(ArtifactEventType.METADATA_EXTRACTED, {
            "duration": self.duration,
            "codec": self.codec,
            "bitrate": self.bitrate,
            "sample_rate": self.sample_rate,
            "channels": self.channels,
        })

    def validate(self) -> bool:
        if not self.filename:
            return False
        if self.file_path and not Path(self.file_path).exists():
            return False
        self.state = ArtifactState.VALIDATED
        self.emit(ArtifactEventType.VALIDATED, {"hash": self.file_hash})
        return True

    def _hash_file(self, path: str) -> str:
        sha256 = hashlib.sha256()
        with open(path, "rb") as fh:
            for chunk in iter(lambda: fh.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _hash_bytes(self, data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    def _apply(self, event):
        if event.type == ArtifactEventType.PROCESSING_STARTED:
            self.state = ArtifactState.PROCESSING
        elif event.type == ArtifactEventType.PROCESSING_COMPLETED:
            self.state = ArtifactState.COMPLETED
            self.processing_results.update(event.data or {})
        elif event.type == ArtifactEventType.PROCESSING_FAILED:
            self.state = ArtifactState.FAILED