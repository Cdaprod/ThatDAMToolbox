# video/core/artifacts/_registry.py
from __future__ import annotations
from importlib import import_module
from pathlib   import Path
from typing    import Dict, Type

from .base  import Artifact

_REGISTRY: Dict[str, Type[Artifact]] = {}

def register(ext: str, cls: Type[Artifact]) -> None:
    """
    Register *one* extension ('.mp4', '.pdf' …) **lower-case**.
    """
    if not ext.startswith("."):
        raise ValueError("extension must start with '.'")
    _REGISTRY[ext.lower()] = cls

def by_extension(path: str | Path) -> Type[Artifact] | None:
    return _REGISTRY.get(Path(path).suffix.lower())

# ───────────────── pre-register the standard artefacts ──────────────────── #
def _auto_import(package: str, names: list[str]) -> None:
    for n in names:
        mod = import_module(f"{package}.{n}")
        reg = getattr(mod, "__register__", None)
        if callable(reg):
            reg(register)          # module calls register('.ext', Class)

_auto_import("video.core.artifacts", ["video", "audio", "document"])