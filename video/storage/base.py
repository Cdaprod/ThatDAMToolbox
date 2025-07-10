# video/storage/base.py
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
import numpy as np

class StorageEngine(ABC):
    @abstractmethod
    def add_video(self, path: str, sha1: str, meta: Dict[str,Any]) -> None: ...
    @abstractmethod
    def get_video(self, sha1: str) -> Optional[Dict[str,Any]]: ...
    @abstractmethod
    def list_videos(self, limit:int=50, offset:int=0)->List[Dict[str,Any]]: ...

    # vectors (no-op default keeps pure-Python users happy)
    def add_vector(self, *a, **kw): pass
    def search_vector(self, *a, **kw): return []