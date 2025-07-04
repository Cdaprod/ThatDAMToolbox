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
    docker = shutil.which("docker")
    if not docker:
        return False
    try:
        subprocess.check_output([docker, "info"], stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False

def start_server(host: str = "0.0.0.0",
                 port: int = 8080,
                 *,
                 use_docker: Optional[bool] = None,
                 **uvicorn_opts):          # ← catch any extra CLI flags

    """Entry point ONLY called by the serve CLI action."""
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

    force_std = os.getenv("VIDEO_FORCE_STDHTTP") == "1"
    have_fastapi = _iu.find_spec("fastapi") is not None
    have_uvicorn = _iu.find_spec("uvicorn") is not None

    if not force_std and have_fastapi and have_uvicorn:
        from video.api import app
        import uvicorn
        # Print endpoints banner here, not in api.py
        print("INFO: 📚  Available endpoints:")
        print("INFO:   POST /batches          - Create batch (with pre-flight transcode)")
        print("INFO:   GET  /batches          - List batches")
        print("INFO:   GET  /batches/{name}   - Get batch details")
        print("INFO:   DEL  /batches/{name}   - Delete batch")
        print("INFO:   POST /transcode        - Transcode single file")
        print("INFO:   POST /cli              - Execute CLI command")
        print("INFO:   GET  /jobs             - List all jobs")
        print("INFO:   GET  /jobs/{id}        - Get job status")
        print("INFO:   DEL  /jobs/{id}        - Delete job")
        print("INFO:   GET  /health           - Health check")
        uvicorn.run(app, host=host, port=port, workers=2)
    else:
        from video.server import serve
        serve(host=host, port=port)