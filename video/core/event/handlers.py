"""
/video/core/event/handlers.py

Built-in handler registration utilities.
"""
from __future__ import annotations
import logging
from typing import Callable, Dict, List
from .types import Event

_log = logging.getLogger("event.handlers")

# topic -> list[callable]
_HANDLERS: Dict[str, List[Callable[[Event], None]]] = {}


def bind(topic: str) -> Callable[[Callable[[Event], None]], Callable[[Event], None]]:
    """
    Decorator for registering a synchronous handler.

    Example:
        @bind("dam.ingested")
        def on_ingested(evt: Event): ...
    """
    def _(fn: Callable[[Event], None]) -> Callable[[Event], None]:
        _HANDLERS.setdefault(topic, []).append(fn)
        _log.debug("bound handler %s to topic %s", fn.__name__, topic)
        return fn
    return _


def dispatch(evt: Event) -> None:
    """Fan-out to every handler registered for the event’s topic."""
    for fn in _HANDLERS.get(str(evt.topic), []):
        try:
            fn(evt)
        except Exception as exc:  # noqa: BLE001
            _log.exception("handler %s failed: %s", fn.__name__, exc)