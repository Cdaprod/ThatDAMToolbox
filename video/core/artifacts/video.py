# SPDX-License-Identifier: MIT
# video/core/artifacts/video.py
"""
VideoArtifact 2.0 – core fields + pluggable metadata fragments
--------------------------------------------------------------

* Core identity / state live on the artefact itself.
* All expandable, domain-specific information is stored in
  `self.meta`, an instance of ``VideoMetaContainer``.

Consumers can now do:

    vid.meta.tech.duration               # ffprobe numbers
    vid.meta.image.keywords.append('…')  # EXIF / IPTC
    vid.meta.processing.notes['stage'] = 'inference'
"""

from __future__ import annotations

import hashlib, json
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

from .base   import Artifact, ArtifactState, ArtifactEventType
from .video_metadata_container import VideoMetaContainer
from .metadata import TechMeta        # used internally by extract_metadata()

# (*)  ---- If you want Pydantic’s dataclass wrapper, uncomment:  -------------
# from pydantic.dataclasses import dataclass  # type: ignore  # noqa: E501
# ----------------------------------------------------------------------------


# ────────────────────────────────────────────────────────────────────────────
# The artefact
# ────────────────────────────────────────────────────────────────────────────
@dataclass
class VideoArtifact(Artifact):
    # ---- identity ----------------------------------------------------------
    filename   : str = ""
    source_type: str = ""

    # ---- source location ---------------------------------------------------
    file_path  : Optional[str] = None
    file_hash  : Optional[str] = None

    # ---- expandable metadata container ------------------------------------
    meta: VideoMetaContainer = field(default_factory=VideoMetaContainer)

    # ---- backwards-compat "processing results" bucket ----------------------
    processing_results: Dict[str, Any] = field(default_factory=dict)

    # -----------------------------------------------------------------------
    # Lifecycle helpers
    # -----------------------------------------------------------------------
    def __post_init__(self) -> None:
        super().__post_init__()
        self.emit(ArtifactEventType.CREATED,
                  {"filename": self.filename, "source_type": self.source_type})

    # -----------------------------------------------------------------------
    # Public API
    # -----------------------------------------------------------------------
    # Existing helper kept intact – now writes into meta.tech
    def extract_metadata(self) -> None:
        # Replace with real ffprobe later
        tech = self.meta.tech
        tech.duration   = 120.5
        tech.resolution = (1920, 1080)
        tech.codec      = "h264"
        tech.bitrate    = 5_000_000
        tech.frame_rate = 30.0

        self.emit(ArtifactEventType.METADATA_EXTRACTED,
                  tech.dict(exclude_none=True))

    def set_source_data(
        self, *,
        file_path : Optional[str]  = None,
        file_data : Optional[bytes] = None
    ) -> None:
        if file_path:
            self.file_path = file_path
            self.file_hash = self._hash_file(file_path)
            self.emit(ArtifactEventType.SOURCE_ATTACHED,
                      {"file_path": file_path, "hash": self.file_hash})
        elif file_data:
            self.file_hash = self._hash_bytes(file_data)
            self.emit(ArtifactEventType.DATA_ATTACHED,
                      {"bytes": len(file_data), "hash": self.file_hash})

    def validate(self) -> bool:
        if not self.filename:
            return False
        if self.file_path and not Path(self.file_path).exists():
            return False
        self.state = ArtifactState.VALIDATED
        self.emit(ArtifactEventType.VALIDATED, {"hash": self.file_hash})
        return True

    # -----------------------------------------------------------------------
    # (De)serialisation helpers
    # -----------------------------------------------------------------------
    def to_dict(self, *, exclude_none: bool = True) -> Dict[str, Any]:
        """
        Convert to a plain ``dict`` (JSON-serialisable).
        Non-serialisable stdlib types (Path, datetime, tuples) are coerced.
        """
        try:
            base = self.dict(by_alias=True, exclude_none=exclude_none)  # type: ignore[attr-defined]
        except Exception:
            base = asdict(self)

        # Post-process stdlib types
        for k, v in list(base.items()):
            if exclude_none and v is None:
                base.pop(k); continue
            if isinstance(v, Path):
                base[k] = str(v)
            elif isinstance(v, datetime):
                base[k] = v.isoformat()
            elif isinstance(v, tuple):
                base[k] = list(v)

        # Inject the meta container (skip empty fragments for brevity)
        base["meta"] = self.meta.to_dict()
        return base

    def to_json(self, *, exclude_none: bool = True, **kwargs) -> str:
        return json.dumps(self.to_dict(exclude_none=exclude_none),
                          default=str, **kwargs)

    # -----------------------------------------------------------------------
    # Private helpers
    # -----------------------------------------------------------------------
    @staticmethod
    def _hash_file(path: str) -> str:
        sha256 = hashlib.sha256()
        with open(path, "rb") as fh:
            for chunk in iter(lambda: fh.read(8192), b""):
                sha256.update(chunk)
        return sha256.hexdigest()

    @staticmethod
    def _hash_bytes(data: bytes) -> str:
        return hashlib.sha256(data).hexdigest()

    # -----------------------------------------------------------------------
    # Event reducer (unchanged)
    # -----------------------------------------------------------------------
    def _apply(self, event):  # noqa: D401
        if event.type == ArtifactEventType.PROCESSING_STARTED:
            self.state = ArtifactState.PROCESSING
        elif event.type == ArtifactEventType.PROCESSING_COMPLETED:
            self.state = ArtifactState.COMPLETED
            self.processing_results.update(event.data or {})
        elif event.type == ArtifactEventType.PROCESSING_FAILED:
            self.state = ArtifactState.FAILED