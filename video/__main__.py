#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""
/video/__main__.py

Smart launcher.

• Positional args present  → CLI (`video.cli.run_cli`)
• No positional args       → API server via video.bootstrap.start_server
  – honours env-vars:
      VIDEO_FORCE_STDHTTP=1   # always use fallback HTTPServer
      VIDEO_MODE=cli|api      # override arg-based detection
      UVICORN_WORKERS=2       # forwarded to video.bootstrap
"""
from __future__ import annotations

import importlib.util as _iu
import os
import sys

from video import config               # side-effect: env validation + dir creation
from video.config import ensure_dirs
from video.bootstrap import start_server

ensure_dirs()                           # auto-create data directories

if os.getenv("VIDEO_SHOW_CFG") == "1":
    config.print_config()               # pretty table of runtime cfg

# --------------------------------------------------------------------------- #
# helpers                                                                     #
# --------------------------------------------------------------------------- #
def _have(pkg: str) -> bool:
    return _iu.find_spec(pkg) is not None


def _want_cli() -> bool:
    forced = os.getenv("VIDEO_MODE", "").lower()
    if forced in {"cli", "api"}:
        return forced == "cli"
    # any extra positional arg → CLI
    return len(sys.argv) > 1


# --------------------------------------------------------------------------- #
# entry-point                                                                 #
# --------------------------------------------------------------------------- #
def main() -> None:          # pragma: no-cover
    from video.cli import run_cli, build_parser

    # ---- CLI branch -------------------------------------------------------
    if _want_cli():
        # `video --help` without further args → print help + exit
        if len(sys.argv) == 1 or sys.argv[1] in {"-h", "--help"}:
            build_parser().print_help()
            return
        run_cli()
        return

    # ---- API branch -------------------------------------------------------
    # Everything (Docker vs Uvicorn vs stdlib) is already handled in bootstrap
    start_server(
        host=os.getenv("VIDEO_HOST", "0.0.0.0"),
        port=int(os.getenv("VIDEO_PORT", "8080")),
    )


if __name__ == "__main__":   # pragma: no-cover
    main()