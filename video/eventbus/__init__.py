"""Minimal event bus facade for Python services.

Usage:
    from video.eventbus import publish
    publish("topic", {"hello": "world"})
"""

from __future__ import annotations
import json
import os
from typing import Callable, Optional

import pika


class _AMQPBus:
    def __init__(self, url: str, exchange: str) -> None:
        self._conn = pika.BlockingConnection(pika.URLParameters(url))
        self._ch = self._conn.channel()
        self._exchange = exchange
        self._ch.exchange_declare(exchange=exchange, exchange_type="topic", durable=True)

    def publish(self, topic: str, payload: dict) -> None:
        body = json.dumps(payload).encode()
        self._ch.basic_publish(self._exchange, topic, body, pika.BasicProperties(content_type="application/json"))

    def subscribe(self, topic: str, handler: Callable[[bytes], None]) -> None:
        q = self._ch.queue_declare("", exclusive=True)
        name = q.method.queue
        self._ch.queue_bind(name, self._exchange, topic)
        def _cb(ch, method, properties, body):
            handler(body)
        self._ch.basic_consume(name, _cb, auto_ack=True)

    def close(self) -> None:
        self._conn.close()

_bus: Optional[_AMQPBus] = None

def connect(url: str | None = None, exchange: str = "events") -> _AMQPBus:
    """Connect returns a singleton bus instance."""
    global _bus
    if _bus is None:
        url = url or os.getenv("AMQP_URL", "amqp://guest:guest@localhost/")
        exchange = exchange or os.getenv("AMQP_EXCHANGE", "events")
        _bus = _AMQPBus(url, exchange)
    return _bus

def publish(topic: str, payload: dict) -> None:
    connect().publish(topic, payload)

