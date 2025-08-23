"""Minimal event bus facade for Python services.

Usage:
    from video.eventbus import publish
    publish("topic", {"hello": "world"})
"""

from __future__ import annotations

import json
import logging
import os
from typing import Callable, Optional, Protocol

try:  # pragma: no cover - optional dependency
    import pika  # type: ignore
except Exception:  # pragma: no cover - handled via fallback bus
    pika = None  # type: ignore[assignment]


class EventBus(Protocol):
    """Protocol for minimal publish/subscribe interface."""

    def publish(self, topic: str, payload: dict) -> None:  # pragma: no cover - interface
        ...

    def subscribe(self, topic: str, handler: Callable[[bytes], None]) -> None:  # pragma: no cover - interface
        ...

    def close(self) -> None:  # pragma: no cover - interface
        ...


class _NullBus:
    """No-op event bus used when pika is unavailable."""

    def publish(self, topic: str, payload: dict) -> None:
        logging.getLogger(__name__).debug(
            "Dropping event %s; AMQP backend disabled", topic
        )

    def subscribe(self, topic: str, handler: Callable[[bytes], None]) -> None:
        logging.getLogger(__name__).debug(
            "AMQP backend disabled; cannot subscribe to %s", topic
        )

    def close(self) -> None:
        pass


class _AMQPBus:
    """Real AMQP-backed event bus."""

    def __init__(self, url: str, exchange: str) -> None:
        self._conn = pika.BlockingConnection(pika.URLParameters(url))  # type: ignore[attr-defined]
        self._ch = self._conn.channel()
        self._exchange = exchange
        self._ch.exchange_declare(
            exchange=exchange, exchange_type="topic", durable=True
        )

    def publish(self, topic: str, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self._ch.basic_publish(
            self._exchange,
            topic,
            body,
            pika.BasicProperties(content_type="application/json"),  # type: ignore[attr-defined]
        )

    def subscribe(self, topic: str, handler: Callable[[bytes], None]) -> None:
        q = self._ch.queue_declare("", exclusive=True)
        name = q.method.queue
        self._ch.queue_bind(name, self._exchange, topic)

        def _cb(ch, method, properties, body):
            handler(body)

        self._ch.basic_consume(name, _cb, auto_ack=True)

    def close(self) -> None:
        self._conn.close()


_bus: Optional[EventBus] = None


def connect(url: str | None = None, exchange: str = "events") -> EventBus:
    """Connect returns a singleton bus instance."""
    global _bus
    if _bus is None:
        if pika is None:
            _bus = _NullBus()
        else:
            url = (
                url
                or os.getenv("EVENT_BROKER_URL")
                or os.getenv("AMQP_URL", "amqp://video:video@localhost/")
            )
            exchange = exchange or os.getenv("AMQP_EXCHANGE", "events")
            _bus = _AMQPBus(url, exchange)
    return _bus


def publish(topic: str, payload: dict) -> None:
    connect().publish(topic, payload)
