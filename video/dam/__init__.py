### video/dam/__init__.py
"""
Video-centric Digital Asset Management (DAM) system with embedding-first architecture.
Implements four-level hierarchy for multimodal vector storage and retrieval.
"""

__version__ = "1.0.0"
__author__ = "DAM System"

from .main import app
from .commands import register_commands

__all__ = ["app", "register_commands"]