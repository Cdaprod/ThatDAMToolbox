#!/usr/bin/env python3
"""
Smart bootstrap for the *video* API:

• If Docker is available → run the pre-built container
• Else if FastAPI+Uvicorn installed → run in-process
• Else → fall back to the pure-stdlib HTTP server
"""
from __future__ import annotations
import os, shutil, subprocess, importlib.util as _iu, logging
from typing import Optional

# --------------------------------------------------------------------------- #
# helpers                                                                     #
# --------------------------------------------------------------------------- #
_log = logging.getLogger("video.bootstrap")

def _banner(app) -> None:                     # FastAPI imported later → loose type
    """Log the public FastAPI routes once."""
    _log.info("📚  Available endpoints:")
    for r in sorted(app.routes, key=lambda _r: _r.path):
        if r.include_in_schema is False:
            continue                          # skip /docs, /openapi.json, etc.
        methods = ",".join(m for m in r.methods if m not in ("HEAD", "OPTIONS"))
        _log.info("  %-7s %s", methods, r.path)

def _have_docker() -> bool:
    exe = shutil.which("docker")
    if not exe:
        return False
    try:
        subprocess.check_output([exe, "info"], stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False

# --------------------------------------------------------------------------- #
# public entry-point                                                          #
# --------------------------------------------------------------------------- #
def start_server(host: str = "0.0.0.0",
                 port: int = 8080,
                 *,
                 use_docker: Optional[bool] = None,
                 **uvicorn_opts) -> None:
    """
    Decide **once** where to run the API and launch it.

    Called by:  `python -m video serve …`  or  `video.cli → serve`
    """
    # ── 1) Docker host-level container ──────────────────────────────────────
    if use_docker is None:
        use_docker = os.getenv("VIDEO_USE_DOCKER") == "1" or _have_docker()

    if use_docker:
        image = os.getenv("VIDEO_DOCKER_IMAGE", "cdaprod/video:latest")
        cmd = [
            "docker", "run", "--rm",
            "-p", f"{port}:{port}",
            "-e", "VIDEO_FORCE_STDHTTP=0",
            image
        ]
        _log.info("🛳️  launching host container: %s", " ".join(cmd))
        subprocess.run(cmd, check=True)
        return                                   # never returns on success

    # ── 2) In-process (FastAPI or stdlib fallback) ──────────────────────────
    force_std  = os.getenv("VIDEO_FORCE_STDHTTP") == "1"
    have_fast  = _iu.find_spec("fastapi")  is not None
    have_uci   = _iu.find_spec("uvicorn") is not None

    if not force_std and have_fast and have_uci:
        from video.api import app               # local import = cheap if unused
        import uvicorn

        _banner(app)

        # default workers=2 unless caller overrides via **uvicorn_opts
        uvicorn.run(app, host=host, port=port,
                    workers=uvicorn_opts.pop("workers", 2),
                    **uvicorn_opts)
    else:
        from video.server import serve
        serve(host=host, port=port)