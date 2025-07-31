"""
/video/core/event/__init__.py

Public Export:
    get_bus() -> EventBus singleton
"""
from __future__ import annotations
from .lifecycle_hooks import init_event_bus

__all__ = ["get_bus"]

def get_bus():
    """Return the lazily initialised EventBus singleton."""
    return init_event_bus()l