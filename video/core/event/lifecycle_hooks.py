"""
/video/core/event/lifecycle_hooks.py

Glue between the global lifecycle system and the EventBus.
Production-grade with proper error handling and timeouts.
"""
from __future__ import annotations
import asyncio
import logging
import threading
from typing import Optional
from video.lifecycle import on_shutdown
from .bus import EventBus
from .types import Event, Topic

_log = logging.getLogger("event.lifecycle_hooks")

_EVENT_BUS: Optional[EventBus] = None
_INIT_LOCK = threading.Lock()
_INIT_FAILED = False


async def _safe_bus_operation(operation_name: str, coro, timeout: float = 5.0) -> bool:
    """Execute bus operation with timeout and error handling."""
    try:
        await asyncio.wait_for(coro, timeout=timeout)
        _log.debug("EventBus: %s completed", operation_name)
        return True
    except asyncio.TimeoutError:
        _log.warning("EventBus: %s timed out after %.1fs", operation_name, timeout)
        return False
    except Exception as exc:
        _log.error("EventBus: %s failed - %s", operation_name, exc)
        return False


async def _shutdown_async() -> None:
    """Graceful shutdown with shorter timeouts."""
    if _EVENT_BUS and not _INIT_FAILED:
        # Publish shutdown event with shorter timeout
        await _safe_bus_operation(
            "shutdown event publish",
            _EVENT_BUS.publish(Event(topic=Topic.LIFECYCLE_SHUTDOWN)),
            timeout=2.0
        )
        
        # Close bus connection
        await _safe_bus_operation(
            "bus close",
            _EVENT_BUS.close(),
            timeout=3.0
        )


def init_event_bus() -> Optional[EventBus]:
    """
    Create and start the singleton EventBus with proper error handling.
    
    Returns None if initialization fails, allowing graceful degradation.
    """
    global _EVENT_BUS, _INIT_FAILED
    
    # Thread-safe singleton with early return
    if _EVENT_BUS is not None:
        return _EVENT_BUS
    
    if _INIT_FAILED:
        return None
    
    with _INIT_LOCK:
        # Double-check after acquiring lock
        if _EVENT_BUS is not None:
            return _EVENT_BUS
        
        if _INIT_FAILED:
            return None
            
        try:
            bus = EventBus()
            
            # Start the bus with timeout
            if not asyncio.run(_safe_bus_operation("bus start", bus.start())):
                _INIT_FAILED = True
                return None
            
            # Publish startup event
            startup_success = asyncio.run(_safe_bus_operation(
                "startup event publish",
                bus.publish(Event(topic=Topic.LIFECYCLE_STARTUP))
            ))
            
            if not startup_success:
                _log.warning("EventBus: Started but failed to publish startup event")
                # Continue anyway - bus is functional
            
            # Register shutdown hook
            on_shutdown(lambda: asyncio.run(_shutdown_async()))
            
            _EVENT_BUS = bus
            _log.info("EventBus: Initialized and wired into lifecycle")
            return _EVENT_BUS
            
        except Exception as exc:
            _log.error("EventBus: Initialization failed - %s", exc)
            _INIT_FAILED = True
            return None