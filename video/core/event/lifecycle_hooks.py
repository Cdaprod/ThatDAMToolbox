"""
/video/core/event/lifecycle_hooks.py

Glue between the global lifecycle system and the EventBus.
"""
from __future__ import annotations
import asyncio, logging
from video.lifecycle import on_shutdown, startup
from .bus import EventBus
from .types import Event, Topic

_log = logging.getLogger("event.lifecycle_hooks")

_EVENT_BUS: EventBus | None = None


async def _shutdown_async() -> None:
    if _EVENT_BUS:
        await _EVENT_BUS.publish(Event(topic=Topic.LIFECYCLE_SHUTDOWN))
        await _EVENT_BUS.close()


def init_event_bus() -> EventBus:
    """Create and start the singleton EventBus; idempotent."""
    global _EVENT_BUS
    if _EVENT_BUS is None:
        _EVENT_BUS = EventBus()
        asyncio.run(_EVENT_BUS.start())
        asyncio.run(_EVENT_BUS.publish(Event(topic=Topic.LIFECYCLE_STARTUP)))
        on_shutdown(lambda: asyncio.run(_shutdown_async()))
        _log.info("EventBus initialised and wired into lifecycle")
    return _EVENT_BUS