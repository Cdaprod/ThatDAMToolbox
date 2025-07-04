#!/usr/bin/env python3
"""
Smart launcher – FastAPI if available, stdlib HTTP fallback otherwise.

⋄ Set VIDEO_FORCE_STDHTTP=1 to force the fallback even when FastAPI is
  installed (helpful for quick tests or when Uvicorn is missing).
"""
import importlib.util as _iu
import os
import sys

_FORCE_STD = os.getenv("VIDEO_FORCE_STDHTTP") == "1"

def _have(pkg: str) -> bool:
    return _iu.find_spec(pkg) is not None

if not _FORCE_STD and _have("fastapi") and _have("uvicorn"):
    # --- FastAPI path --------------------------------------------------------
    from video.api import app                # your async app (video/api.py)
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080, workers=2)
else:
    # --- Stdlib fallback -----------------------------------------------------
    from video.server import serve           # the file you pasted above
    serve()

from .cli import run_cli
if __name__ == "__main__":
    run_cli()