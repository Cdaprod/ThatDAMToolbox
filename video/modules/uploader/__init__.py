#!/usr/bin/env python3
"""
/video/modules/uploader/__init__.py
(video.modules.uploader)
======================

Write-side companion to *explorer*:

• REST  – POST /api/v1/upload/…          → routes.py
• CLI   – `video upload …`               → commands.py
• Paths – auto-created module data dirs  → DATA_DIR/modules/uploader/…

The core plug-in loader (video.modules.__init__) just has to `import` this
package; everything else is handled automatically.
"""
from __future__ import annotations

import logging
from importlib import import_module
from pathlib   import Path

from video.config import DATA_DIR, register_module_paths

log = logging.getLogger("video.uploader")

# ─────────────────────────────────────────────────────────────────────────────
# 1) Declare per-module data directories  (exposed later at /modules/uploader/*)
# ─────────────────────────────────────────────────────────────────────────────
MODULE_PATH_DEFAULTS = {
    "staging": "_INCOMING/web",         # raw multipart uploads land here first
}

register_module_paths(
    "uploader",
    {k: DATA_DIR / "modules" / "uploader" / v for k, v in MODULE_PATH_DEFAULTS.items()},
)

# ensure they exist on boot
for p in register_module_paths("uploader")["uploader"].values():  # type: ignore[arg-type]
    Path(p).mkdir(parents=True, exist_ok=True)
    log.debug("Ensured directory: %s", p)

# ─────────────────────────────────────────────────────────────────────────────
# 2) REST router (re-export for the FastAPI auto-includer)
# ─────────────────────────────────────────────────────────────────────────────
router = import_module(".routes", __name__).router
log.debug("Uploader router ready")

# ─────────────────────────────────────────────────────────────────────────────
# 3) CLI verb – registers itself with video.cli via side-effects
# ─────────────────────────────────────────────────────────────────────────────
try:
    import_module(".commands", __name__)
    log.debug("Uploader CLI verb registered")
except ImportError:
    log.debug("Uploader CLI verb skipped (optional dependency missing)")

__all__ = ["router"]