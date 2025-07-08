#!/usr/bin/env python3
"""
Dynamic plugin loader for the video.modules namespace.

- Imports every subpackage in video/modules/
- Imports their __init__.py, commands.py, and router.py (if present)
- Collects all routers as video.modules.routers (for FastAPI auto-inclusion)
- CLI verbs and registrations should be done via side-effects in commands.py
- No manual editing ever required!
"""

import os, importlib, logging

log = logging.getLogger("video.modules")
_this_dir = os.path.dirname(__file__)

routers = []  # Collect FastAPI routers (optional usage)

for modname in os.listdir(_this_dir):
    mod_path = os.path.join(_this_dir, modname)
    if not os.path.isdir(mod_path):
        continue
    # Must be a package (has __init__.py)
    if not os.path.exists(os.path.join(mod_path, "__init__.py")):
        continue
    fqname = f"{__package__}.{modname}"  # video.modules.<modname>
    try:
        mod = importlib.import_module(fqname)
        log.info(f"Loaded module: {fqname}")
        # Import commands.py for CLI registration (side effects)
        try:
            importlib.import_module(f"{fqname}.commands")
            log.info(f"Loaded commands for {fqname}")
        except ImportError:
            pass  # Not all modules need commands
        # Import router.py if you want (optional)
        try:
            router_mod = importlib.import_module(f"{fqname}.router")
            # If router.py exposes 'router', collect it (preferred FastAPI style)
            if hasattr(router_mod, "router"):
                routers.append(router_mod.router)
                log.info(f"Collected router from {fqname}.router")
        except ImportError:
            # Fallback: If router was in __init__.py (legacy style)
            if hasattr(mod, "router"):
                routers.append(mod.router)
                log.info(f"Collected router from {fqname}")
        except Exception as e:
            log.warning(f"Failed to import router for {fqname}: {e}")
    except Exception as e:
        log.warning(f"Failed to import module {fqname}: {e}")

# Optionally: expose routers for FastAPI auto-inclusion in /video/__init__.py or main
__all__ = []