"""video.api package - exposes a FastAPI application factory."""
from .app import create_app

__all__ = ["create_app"]
