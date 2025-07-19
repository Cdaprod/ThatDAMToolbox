#!/usr/bin/env python3
"""
/video/modules/__init__.py

Dynamic plugin loader for the video.modules namespace.

- Imports every subpackage in video/modules/
- Imports their __init__.py, commands.py, and router.py (if present)
- Collects all routers as video.modules.routers (for FastAPI auto-inclusion)
- CLI verbs and registrations should be done via side-effects in commands.py
- No manual editing ever required!
See docstring above...
"""

import os, importlib, logging
from pathlib import Path

from video.config import DATA_DIR, register_module_paths

log = logging.getLogger("video.modules")
_this_dir = os.path.dirname(__file__)

routers: list = []

MODULES_ROOT = DATA_DIR / "modules"

for modname in os.listdir(_this_dir):
    mod_path = os.path.join(_this_dir, modname)
    if not os.path.isdir(mod_path) or not os.path.exists(f"{mod_path}/__init__.py"):
        continue

    fqname = f"{__package__}.{modname}"
    try:
        mod = importlib.import_module(fqname)
        log.info(f"Loaded module: {fqname}")

        # --- AUTOMATIC MODULE PATH REGISTRATION ------------------------
        # Look for MODULE_PATH_DEFAULTS in the module
        defaults = getattr(mod, "MODULE_PATH_DEFAULTS", None)
        if isinstance(defaults, dict):
            # build full absolute paths under DATA_DIR/modules/<modname>/
            full = {
                key: MODULES_ROOT / modname / rel
                for key, rel in defaults.items()
            }
            register_module_paths(modname, full)
            log.info(f"Registered paths for {modname}: {full!r}")

        # --- CLI commands (side-effects) -------------------------------
        try:
            importlib.import_module(f"{fqname}.commands")
            log.info(f"Loaded commands for {fqname}")
        except ImportError:
            pass

        # --- FastAPI routers --------------------------------------------
        try:
            router_mod = importlib.import_module(f"{fqname}.router")
            if hasattr(router_mod, "router"):
                routers.append(router_mod.router)
                log.info(f"Collected router from {fqname}.router")
        except ImportError:
            if hasattr(mod, "router"):
                routers.append(mod.router)
                log.info(f"Collected router from {fqname}")
        except Exception as e:
            log.warning(f"Failed to import router for {fqname}: {e}")

    except Exception as e:
        log.warning(f"Failed to load module {fqname}: {e}")

__all__ = ["routers"]