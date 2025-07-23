# video/core/artifacts/video_metadata_container.py
from __future__ import annotations
from typing import Type, TypeVar, Iterator, Dict, Any

from .metadata import MetaBase, TechMeta, ImageMeta, ProcessingMeta

T = TypeVar("T", bound=MetaBase)

_DEFAULTS = {
    TechMeta : TechMeta(),
    ImageMeta: ImageMeta(),
    ProcessingMeta: ProcessingMeta(),
}

class VideoMetaContainer:
    """
    Mapping-like container that holds exactly one instance of each MetaBase
    subclass.  Unknown fragments can be added at runtime.
    """

    def __init__(self, initial: Dict[Type[MetaBase], MetaBase] | None = None):
        self._store: Dict[Type[MetaBase], MetaBase] = dict(_DEFAULTS)
        if initial:
            self._store.update(initial)

    # ---- mapping-ish API ------------------------------------------------- #
    def __getitem__(self, cls: Type[T]) -> T:
        return self._store.setdefault(cls, cls())   # auto-create

    def __setitem__(self, cls: Type[T], value: T) -> None:
        if not issubclass(cls, MetaBase):
            raise TypeError("key must be MetaBase subclass")
        self._store[cls] = value

    def __iter__(self) -> Iterator[MetaBase]:
        return iter(self._store.values())

    # ---- convenience dotted access -------------------------------------- #
    @property
    def tech(self) -> TechMeta: return self[TechMeta]

    @property
    def image(self) -> ImageMeta: return self[ImageMeta]

    @property
    def processing(self) -> ProcessingMeta: return self[ProcessingMeta]

    # ---- (de)serialisation ---------------------------------------------- #
    def to_dict(self) -> Dict[str, Any]:
        return {cls.__name__: inst.dict(exclude_none=True)
                for cls, inst in self._store.items() if inst.dict(exclude_none=True)}

    @classmethod
    def from_dict(cls, raw: Dict[str, Any]) -> "VideoMetaContainer":
        init: Dict[Type[MetaBase], MetaBase] = {}
        for fragment_cls in _DEFAULTS:
            if fragment_cls.__name__ in raw:
                init[fragment_cls] = fragment_cls(**raw[fragment_cls.__name__])
        return cls(init)