"""Path helpers and module-specific path registry."""
from __future__ import annotations

from pathlib import Path
import os
import tempfile
import configparser
from typing import Dict
import logging

log = logging.getLogger("video.paths")

# honour an env-var so users can override
_BASE = Path(os.getenv("VIDEO_TMP", "/tmp/video-scratch"))


def get_tmp_subdir(name: str) -> Path:
    """Return (and create) a writable sub-directory for temporary artefacts."""
    sub = _BASE / name
    sub.mkdir(parents=True, exist_ok=True)
    return sub


# ---------------------------------------------------------------------------
# Module path registry (moved from config.py)
# ---------------------------------------------------------------------------

MODULE_PATH_REGISTRY: Dict[str, Dict[str, Path]] = {}


def register_module_paths(module_name: str, defaults: Dict[str, Path]) -> None:
    """Register filesystem paths for a plug‑in.

    Each module may declare a ``module.cfg`` file living beside its package.
    This helper ensures the file exists and records the resolved directories.
    """
    import importlib.util

    spec = importlib.util.find_spec(f"video.modules.{module_name}")
    if not spec or not spec.origin:
        raise ImportError(f"Cannot locate video.modules.{module_name!r}")
    module_dir = Path(spec.origin).parent

    module_cfg_path = module_dir / "module.cfg"
    module_cfg = configparser.ConfigParser()
    if module_cfg_path.exists():
        module_cfg.read(module_cfg_path)

    section = f"module:{module_name}"
    if not module_cfg.has_section(section):
        module_cfg.add_section(section)

    resolved: Dict[str, Path] = {}
    for key, fallback in defaults.items():
        if module_cfg.has_option(section, key):
            p = Path(module_cfg.get(section, key)).expanduser()
        else:
            p = fallback
            module_cfg.set(section, key, str(p))

        try:
            p.mkdir(parents=True, exist_ok=True)
        except Exception as e:  # pragma: no cover - best effort
            log.warning(
                "Could not create module path %s:%s at %s – %s", module_name, key, p, e
            )
        resolved[key] = p

    try:
        with open(module_cfg_path, "w") as f:
            module_cfg.write(f)
        log.info("Wrote module config for %r to %s", module_name, module_cfg_path)
    except Exception as e:  # pragma: no cover
        log.warning(
            "Failed to write module config for %r at %s: %s", module_name, module_cfg_path, e
        )

    MODULE_PATH_REGISTRY[module_name] = resolved


def get_module_path(module_name: str, key: str) -> Path:
    """Retrieve previously registered module path."""
    try:
        return MODULE_PATH_REGISTRY[module_name][key]
    except KeyError as e:  # pragma: no cover - explicit error
        raise KeyError(
            f"No path registered for module={module_name!r}, key={key!r}"
        ) from e


__all__ = [
    "get_tmp_subdir",
    "register_module_paths",
    "get_module_path",
    "MODULE_PATH_REGISTRY",
]
