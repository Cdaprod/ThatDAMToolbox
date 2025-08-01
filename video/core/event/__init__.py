"""
/video/core/event/__init__.py

Public export:
    get_bus()  →  EventBus singleton (RabbitMQ or in-process)
"""
from __future__ import annotations

from .lifecycle_hooks import init_event_bus as _init_event_bus

__all__ = ["get_bus"]


def get_bus():
    """Return the lazily-initialised, lifecycle-managed EventBus."""
    return _init_event_bus()