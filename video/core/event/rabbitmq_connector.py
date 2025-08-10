"""
/video/core/event/rabbitmq_connector.py

Async RabbitMQ backend that matches the interface expected by lifecycle hooks
(start → publish → close) -- now with channel readiness + retry.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from typing import Optional

import aio_pika
import aiormq

from .types import Event  # assumes Event has .to_dict()

_log = logging.getLogger("event.rabbitmq")


class RabbitMQBus:
    """Async wrapper around aio-pika with resilient channel handling."""

    def __init__(self, amqp_url: str) -> None:
        self._url = amqp_url
        self._conn: Optional[aio_pika.RobustConnection] = None
        self._chan: Optional[aio_pika.RobustChannel] = None
        self._ready_evt = asyncio.Event()
        self._lock = asyncio.Lock()

    # ------------------------------------------------------------------ #
    async def start(self) -> None:
        """
        Connect and open a channel. Safe to call multiple times.
        Signals readiness when the channel is open.
        """
        async with self._lock:
            # if already connected and channel open, we're done
            if self._conn and not self._conn.is_closed and self._chan and not self._chan.is_closed:
                self._ready_evt.set()
                return

            self._ready_evt.clear()
            self._conn = await aio_pika.connect_robust(
                self._url,
                timeout=5.0,
                client_properties={"connection_name": "video-eventbus"},
            )
            # publisher_confirms False is faster and avoids confirm wait on reconnects
            self._chan = await self._conn.channel(publisher_confirms=False)
            await self._chan.set_qos(prefetch_count=32)
            self._ready_evt.set()
            _log.info("RabbitMQ bus connected → %s", self._url)

    async def wait_ready(self, timeout: float | None = 10.0) -> bool:
        """Wait until a channel is ready (or timeout)."""
        try:
            await asyncio.wait_for(self._ready_evt.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False

    async def _ensure_channel(self) -> aio_pika.RobustChannel:
        """
        Ensure we have an open channel. Recreate if needed.
        """
        if not self._conn or self._conn.is_closed:
            await self.start()
        assert self._conn is not None
        if not self._chan or self._chan.is_closed:
            self._chan = await self._conn.channel(publisher_confirms=False)
            await self._chan.set_qos(prefetch_count=32)
        self._ready_evt.set()
        return self._chan

    # ------------------------------------------------------------------ #
    async def publish(self, evt: Event) -> None:
        """
        Resilient publish: ensures channel and retries briefly if the channel
        is in the middle of a reconnect open/close cycle.
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
                exchange = chan.default_exchange  # default "" exchange
                await exchange.publish(
                    aio_pika.Message(body=body, content_type="application/json"),
                    routing_key=rk,
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
            if self._conn and not self._conn.is_closed:
                await self._conn.close()
            self._conn = None
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