"""
/video/core/event/bus.py

Lightweight async-capable EventBus.

* Works in-process by default.
* Transparently switches to RabbitMQ (aio-pika) if
  `EVENT_BROKER_URL` env-var is set.
"""
from __future__ import annotations
import asyncio, json, logging, os
from contextlib import asynccontextmanager
from typing import Callable, Dict, List
from .types import Event
from .middleware import run_pre, run_post
from .handlers import dispatch as dispatch_to_local_handlers

_log = logging.getLogger("event.bus")


class _InProcessBackend:
    """Pub/Sub within the same Python process – Thread + asyncio safe."""
    def __init__(self) -> None:
        self._subscribers: Dict[str, List[Callable[[Event], None]]] = {}

    async def publish(self, evt: Event) -> None:
        dispatch_to_local_handlers(evt)          # call handler registry

        for fn in self._subscribers.get(str(evt.topic), []):
            try:
                if asyncio.iscoroutinefunction(fn):
                    await fn(evt)
                else:
                    fn(evt)
            except Exception as exc:             # noqa: BLE001
                _log.exception("subscriber error: %s", exc)

    def subscribe(self, topic: str, fn: Callable[[Event], None]) -> None:
        self._subscribers.setdefault(topic, []).append(fn)
        _log.debug("subscribed %s to %s (in-proc)", fn, topic)


class EventBus:
    """Facade selecting the right backend based on ENV."""
    def __init__(self) -> None:
        self._backend: _InProcessBackend | None = None
        self._amqp_url: str | None = os.getenv("EVENT_BROKER_URL")

    # ------------------------------------------------------------------ #
    async def start(self) -> None:
        if self._backend is not None:
            return

        if self._amqp_url:
            try:
                import aio_pika  # local-import so library is optional
                self._aio_pika = aio_pika                 # stash for reuse
                self._conn     = await aio_pika.connect_robust(self._amqp_url)
                self._chan     = await self._conn.channel()
                await self._chan.set_qos(prefetch_count=32)
                self._backend  = None   # use AMQP path
                _log.info("EventBus connected to RabbitMQ at %s", self._amqp_url)
            except ModuleNotFoundError as err:
                _log.warning("aio-pika not installed – falling back to in-proc bus (%s)", err)
        if self._backend is None:
            self._backend = _InProcessBackend()
            _log.info("EventBus using in-process backend")

    # ------------------------------------------------------------------ #
    async def publish(self, evt: Event) -> None:
        evt = run_pre(evt)  # apply pre-middleware
        if evt is None:
            return

        if self._backend:
            await self._backend.publish(evt)
        else:
            await self._chan.default_exchange.publish(
                self._aio_pika.Message(body=json.dumps(evt.to_dict()).encode()),
                routing_key=str(evt.topic),
            )
        run_post(evt)       # post-middleware

    def subscribe(self, topic: str, fn: Callable[[Event], None]) -> None:
        if self._backend:
            self._backend.subscribe(topic, fn)
        else:
            raise RuntimeError("subscribe() only allowed before start() when using RabbitMQ")

    # ------------------------------------------------------------------ #
    async def close(self) -> None:
        if self._backend is None and hasattr(self, "_conn"):
            await self._conn.close()
            _log.info("EventBus closed RabbitMQ connection")