"""
/video/core/event/middleware.py

Simple middleware chain for pre-/post-publish event filtering.
"""
from __future__ import annotations
import json
from pathlib import Path
from typing import Callable, List, TYPE_CHECKING
from .types import Event

Middleware = Callable[[Event], Event | None]  # return None to swallow event

_PRE:  List[Middleware] = []
_POST: List[Middleware] = []


def add_pre(fn: Middleware) -> None:
    """Run *before* the event is published."""
    _PRE.append(fn)


def add_post(fn: Middleware) -> None:
    """Run *after* subscribers have been notified."""
    _POST.append(fn)


def run_pre(evt: Event) -> Event | None:
    for fn in _PRE:
        evt = fn(evt)                       # type: ignore
        if evt is None:                     # swallowed
            return None
    return evt


def run_post(evt: Event) -> None:
    for fn in _POST:
        fn(evt)


def _audit(evt: Event) -> None:
    if not str(evt.topic).startswith("tenant."):
        return
    path = Path("data") / "audit.log"
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as fh:
        fh.write(json.dumps(evt.to_dict()) + "\n")


add_post(_audit)
