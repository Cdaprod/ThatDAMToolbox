# video/core/artifacts/_mixins.py
from __future__ import annotations
from typing import Any, Dict, Type, TypeVar, Generic, Iterator

from pydantic import Field

from .metadata import MetaBase

T = TypeVar("T", bound=MetaBase)


class MetadataMixin(Generic[T]):
    """
    Drop-in mixin that turns a plain ``dict`` metadata slot into a **typed,
    multi-fragment container** while keeping backwards compatibility.

    *   Legacy code can still do ``self.metadata["foo"] = 123``.
    *   New code can call ``artefact.add_meta(TechMeta(...))`` and get
        proper validation / auto-completion.
    """

    metadata: Dict[str, Any] = Field(default_factory=dict)

    # ------------------------------------------------------------------ #
    # helpers                                                            #
    # ------------------------------------------------------------------ #
    def add_meta(self, fragment: T) -> None:
        """Attach a MetaBase subclass (stored under its class name)."""
        self.metadata[fragment.__class__.__name__] = fragment.dict(exclude_none=True)

    def get_meta(self, cls: Type[T]) -> T | None:
        raw = self.metadata.get(cls.__name__)
        return cls.parse_obj(raw) if raw else None

    def iter_meta(self) -> Iterator[MetaBase]:
        from .metadata import MetaBase   # local import to avoid cycles
        for raw in self.metadata.values():
            if isinstance(raw, dict) and "schema_" not in raw:
                # try to coerce to any known fragment
                for frag in MetaBase.__subclasses__():
                    try:
                        yield frag.parse_obj(raw)
                        break
                    except Exception:
                        continue