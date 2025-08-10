"""
Async RabbitMQ backend that matches the interface expected by lifecycle hooks
(start → publish → close) -- now resilient:
- waits for a ready channel
- auto-reconnects
- optional durable topic exchange (ENV EVENT_EXCHANGE, default: "events")
- no message bounce if no bindings yet (mandatory=False)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from typing import Optional

import aio_pika
import aiormq

from .types import Event  # must provide .to_dict()

_log = logging.getLogger("event.rabbitmq")


class RabbitMQBus:
    """Async wrapper around aio-pika with resilient channel + exchange handling."""

    def __init__(self, amqp_url: str, exchange_name: Optional[str] = "events") -> None:
        self._url = amqp_url
        self._exchange_name = (exchange_name or "").strip()
        self._conn: Optional[aio_pika.RobustConnection] = None
        self._chan: Optional[aio_pika.RobustChannel] = None
        self._exchange: Optional[aio_pika.Exchange] = None
        self._ready_evt = asyncio.Event()
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------ #
    async def start(self) -> None:
        """Connect and open channel (idempotent). Declare exchange if configured."""
        async with self._lock:
            if self._conn and not self._conn.is_closed and self._chan and not self._chan.is_closed:
                # ensure exchange exists if needed
                if self._exchange_name and not self._exchange:
                    self._exchange = await self._chan.declare_exchange(
                        self._exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
                    )
                self._ready_evt.set()
                return

            self._ready_evt.clear()
            self._conn = await aio_pika.connect_robust(
                self._url,
                timeout=5.0,
                client_properties={"connection_name": "video-eventbus"},
            )
            self._chan = await self._conn.channel(publisher_confirms=False)
            await self._chan.set_qos(prefetch_count=32)

            # Declare (or get) a durable topic exchange if a name is provided
            if self._exchange_name:
                self._exchange = await self._chan.declare_exchange(
                    self._exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
                )
                _log.info("RabbitMQ bus connected → %s (exchange=%s)", self._url, self._exchange_name)
            else:
                self._exchange = None
                _log.info("RabbitMQ bus connected → %s (default-exchange)", self._url)

            self._ready_evt.set()

    async def wait_ready(self, timeout: float | None = 10.0) -> bool:
        try:
            await asyncio.wait_for(self._ready_evt.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False

    async def _ensure_channel(self) -> aio_pika.RobustChannel:
        if not self._conn or self._conn.is_closed:
            await self.start()
        assert self._conn is not None
        if not self._chan or self._chan.is_closed:
            self._chan = await self._conn.channel(publisher_confirms=False)
            await self._chan.set_qos(prefetch_count=32)
            # re-acquire exchange on a fresh channel
            if self._exchange_name:
                self._exchange = await self._chan.declare_exchange(
                    self._exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
                )
            else:
                self._exchange = None
        self._ready_evt.set()
        return self._chan

    # ------------------------------------------------------------------ #
    async def publish(self, evt: Event) -> None:
        """
        Resilient publish:
        - ensures channel/exchange is ready
        - retries on transient channel/connection errors
        - mandatory=False so unroutable messages are dropped instead of Basic.Return
        """
        body = json.dumps(evt.to_dict()).encode()
        rk = str(evt.topic)

        attempt = 0
        max_attempts = 5
        backoff = 0.25

        while True:
            attempt += 1
            try:
                chan = await self._ensure_channel()
                exchange = self._exchange if self._exchange is not None else chan.default_exchange
                await exchange.publish(
                    aio_pika.Message(body=body, content_type="application/json"),
                    routing_key=rk,
                    mandatory=False,  # don’t bounce if there are no bindings yet
                )
                return
            except (
                aiormq.exceptions.ChannelInvalidStateError,
                aiormq.exceptions.ConnectionClosed,
                aio_pika.exceptions.AMQPException,
            ) as e:
                if attempt >= max_attempts:
                    _log.warning("EventBus publish failed after %d attempts: %s", attempt, e)
                    raise
                _log.info("EventBus publish retry %d/%d (%.2fs): %s", attempt, max_attempts, backoff, e)
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 2.0)

    # ------------------------------------------------------------------ #
    async def close(self) -> None:
        self._ready_evt.clear()
        try:
            if self._chan and not self._chan.is_closed:
                await self._chan.close()
        finally:
            self._chan = None
            self._exchange = None
            if self._conn and not self._conn.is_closed:
                await self._conn.close()
            self._conn = None
        _log.info("RabbitMQ bus closed")


# ---------------------------------------------------------------------- #
_BUS_SINGLETON: Optional[RabbitMQBus] = None


def get_rabbitmq_bus() -> RabbitMQBus:
    """
    Create / return the singleton RabbitMQBus.

    Env:
      EVENT_BROKER_URL or AMQP_URL  → amqp://user:pass@host:5672/vhost
      EVENT_EXCHANGE                → topic exchange name (default: "events")
                                      set to empty to use default exchange
    """
    global _BUS_SINGLETON
    if _BUS_SINGLETON is None:
        amqp_url = os.getenv("EVENT_BROKER_URL") or os.getenv("AMQP_URL")
        if not amqp_url:
            raise RuntimeError("EVENT_BROKER_URL/AMQP_URL is not set")
        exchange_name = os.getenv("EVENT_EXCHANGE", "events")
        _BUS_SINGLETON = RabbitMQBus(amqp_url, exchange_name=exchange_name)
    return _BUS_SINGLETON