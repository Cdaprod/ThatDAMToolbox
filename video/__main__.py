# /video/__main__.py
#!/usr/bin/env python3
"""
Smart launcher – FastAPI if available, stdlib HTTP fallback otherwise.
- No args: runs API server
- Any CLI args: runs CLI (stats, scan, etc.)
"""
import sys
import importlib.util as _iu
import os

def _have(pkg: str) -> bool:
    return _iu.find_spec(pkg) is not None

def main():
    if len(sys.argv) > 1:
        # Any CLI arguments → run as CLI
        from .cli import run_cli
        run_cli()
    else:
        # No arguments → start API server (FastAPI or fallback)
        _FORCE_STD = os.getenv("VIDEO_FORCE_STDHTTP") == "1"
        if not _FORCE_STD and _have("fastapi") and _have("uvicorn"):
            from video.api import app
            import uvicorn
            uvicorn.run(app, host="0.0.0.0", port=8080, workers=2)
        else:
            from video.server import serve
            serve()

if __name__ == "__main__":
    main()