"""
/video/modules/uploader/__init__.py

video.modules.uploader
======================

Small write-side companion to *explorer*:
• REST router (POST /api/v1/upload/…)            →  routes.py
• Optional CLI verb  `video upload …`            →  cli.py

Because the core app’s auto-loader just import-scans every
`video.modules.*` package, all we need to do here is expose
our FastAPI router (and, if desired, register the CLI hook).

Nothing else is executed at import-time, so unit tests can
`s.importlib.reload()` the module safely.
"""
from importlib import import_module
import logging

log = logging.getLogger("video.uploader")

# ── REST router --------------------------------------------------------------
_routes = import_module(".routes", __name__)
router  = _routes.router         # <-- re-export so api.py can see it
log.debug("uploader router ready")

# ── CLI verb (optional) ------------------------------------------------------
try:
    import_module(".cli", __name__)
    log.debug("uploader CLI verb registered")
except ImportError:
    # If argparse helpers / requests aren’t installed in a minimal build,
    # we quietly skip – the REST API still works.
    log.debug("uploader CLI verb not loaded (optional)")

__all__ = ["router"]