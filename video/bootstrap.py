#!/usr/bin/env python3
"""
Bootstrapping helper for video API:

• If Docker engine is available, spins up the cdaprod/video:latest container
• Else if FastAPI+Uvicorn installed, runs that in‐process
• Else falls back to pure-stdlib HTTPServer
"""
import os
import shutil
import subprocess
import importlib.util as _iu
from typing import Optional

def _have_docker() -> bool:
    """True if `docker info` succeeds."""
    docker = shutil.which("docker")
    if not docker:
        return False
    try:
        subprocess.check_output([docker, "info"], stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False

def start_server(
    host: str = "0.0.0.0",
    port: int = 8080,
    *,
    use_docker: Optional[bool] = None
):
    """
    Launch the API server:

    1) Docker container if use_docker==True or (use_docker is None and Docker exists)
    2) FastAPI+Uvicorn if installed
    3) stdlib HTTPServer fallback
    """
    # decide
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
        print(f"🛳️  launching host container: {' '.join(cmd)}")
        subprocess.run(cmd)
        return

    # in-process path
    force_std = os.getenv("VIDEO_FORCE_STDHTTP") == "1"
    have_fastapi = _iu.find_spec("fastapi") is not None
    have_uvicorn = _iu.find_spec("uvicorn") is not None

    if not force_std and have_fastapi and have_uvicorn:
        # FastAPI/Uvicorn
        from video.api import app
        import uvicorn
        uvicorn.run(app, host=host, port=port, workers=2)
    else:
        # stdlib HTTPServer
        from video.server import serve
        serve(host=host, port=port)