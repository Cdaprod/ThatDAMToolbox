#!/usr/bin/env python3
"""
Smart launcher – FastAPI if available, stdlib HTTP fallback otherwise.

• Positional args present  → CLI (`video.cli.run_cli`)
• No positional args       → API server
  – honours env-vars:
      VIDEO_FORCE_STDHTTP=1   # always use fallback HTTPServer
      VIDEO_MODE=cli|api      # override arg-based detection
      UVICORN_WORKERS=2       # #worker processes for Uvicorn
"""
from __future__ import annotations

import importlib.util as _iu
import os
import sys

from video import config  # side-effect: env validation, dir creation
from video.config import ensure_dirs

ensure_dirs()  # auto-create data directories on import

# Optional banner controlled by env
if os.getenv("VIDEO_SHOW_CFG") == "1":
    config.print_config()  # type: ignore[attr-defined]

WORKERS = int(os.getenv("UVICORN_WORKERS", "1"))


def _have(pkg: str) -> bool:
    return _iu.find_spec(pkg) is not None


def _want_cli() -> bool:
    forced = os.getenv("VIDEO_MODE")
    if forced:
        return forced.lower() == "cli"
    return len(sys.argv) > 1  # any arg → CLI


def main() -> None:  # pragma: no-cover
    """
    •   `video --help`        →  full CLI help
    •   `video`               →  prints help (no silent exit)
    •   all other args        →  CLI
    •   if env VIDEO_MODE=api →  force API
    """
    from video.cli import run_cli, build_parser
    from video.bootstrap import start_server

    # -- show help + exit
    if len(sys.argv) == 1 or sys.argv[1] in ("-h", "--help"):
        build_parser().print_help()
        return

    # explicit API override
    if os.getenv("VIDEO_MODE", "").lower() == "api":
        pass  # fall through to API branch below
    else:
        run_cli()              # all CLI verbs handled here
        return

    # ───── API branch (FastAPI if available, else stdlib HTTP) ─────────
    force_std = os.getenv("VIDEO_FORCE_STDHTTP") == "1"
    if not force_std and _have("fastapi") and _have("uvicorn"):
        from video.api import app     # lazy import
        import uvicorn

        uvicorn.run(app, host="0.0.0.0", port=8080, workers=WORKERS)
    else:
        from video.server import serve
        serve()

if __name__ == "__main__":
    main()