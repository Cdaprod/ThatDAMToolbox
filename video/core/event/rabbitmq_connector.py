"""
/video/core/event/rabbitmq_connector.py

Async RabbitMQ backend that matches the interface expected by
`lifecycle_hooks` (start → publish → close).
It uses aio-pika, so keep that in your `requirements.txt`.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Optional

import aio_pika

from .types import Event

_log = logging.getLogger("event.rabbitmq")


class RabbitMQBus:
    """Minimal async wrapper around aio-pika that looks like EventBus."""

    def __init__(self, amqp_url: str) -> None:
        self._url = amqp_url
        self._conn: Optional[aio_pika.RobustConnection] = None
        self._chan: Optional[aio_pika.Channel] = None

    # ------------------------------------------------------------------ #
    async def start(self) -> None:
        if self._conn:  # already open
            return
        self._conn = await aio_pika.connect_robust(
            self._url,
            timeout=3.0,
            client_properties={"connection_name": "video-eventbus"},
        )
        self._chan = await self._conn.channel()
        await self._chan.set_qos(prefetch_count=32)
        _log.info("RabbitMQ bus connected → %s", self._url)

    # ------------------------------------------------------------------ #
    async def publish(self, evt: Event) -> None:
        if self._chan is None:  # pragma: no cover
            raise RuntimeError("RabbitMQBus.start() not called")
        await self._chan.default_exchange.publish(
            aio_pika.Message(
                body=json.dumps(evt.to_dict()).encode(),
                content_type="application/json",
            ),
            routing_key=str(evt.topic),
        )

    # ------------------------------------------------------------------ #
    async def close(self) -> None:
        if self._conn and not self._conn.is_closed:
            await self._conn.close()
            _log.info("RabbitMQ bus closed")


# ---------------------------------------------------------------------- #
_BUS_SINGLETON: Optional[RabbitMQBus] = None


def get_rabbitmq_bus() -> RabbitMQBus:
    """Create / return the singleton RabbitMQBus."""
    global _BUS_SINGLETON
    if _BUS_SINGLETON is None:
        amqp_url = os.getenv("EVENT_BROKER_URL") or os.getenv("AMQP_URL")
        if not amqp_url:
            raise RuntimeError("EVENT_BROKER_URL/AMQP_URL is not set")
        _BUS_SINGLETON = RabbitMQBus(amqp_url)
    return _BUS_SINGLETON
