# video/storage/base.py
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict, List, Optional


class StorageEngine(ABC):
    # ------------------------------------------------------------
    # Required (pure-metadata) operations
    # ------------------------------------------------------------
    @abstractmethod
    def add_video(
        self, path: str, sha1: str, meta: Dict[str, Any] | None = None
    ) -> None: ...

    @abstractmethod
    def get_video(self, sha1: str) -> Optional[Dict[str, Any]]: ...

    @abstractmethod
    def list_videos(
        self, limit: int = 50, offset: int = 0
    ) -> List[Dict[str, Any]]: ...

    # ------------------------------------------------------------
    # Optional (vector) operations – no-op by default so that
    # a plain-stdlib build doesn’t need to care.
    # ------------------------------------------------------------
    def add_vector(self, *_, **__) -> None:                   # pragma: no cover
        pass

    def search_vector(self, *_, **__) -> List[Dict[str, Any]]:  # pragma: no cover
        return []