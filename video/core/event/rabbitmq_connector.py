"""
Resilient RabbitMQ connector:
- robust connect/reconnect
- durable topic exchange (EVENT_EXCHANGE, default "events"; set "" to use default exchange)
- mandatory=False to avoid Basic.Return when no bindings exist
- return-listener installed (silently drops returns)
- loud import + start logs so you can confirm it’s the version running
"""
from __future__ import annotations

import asyncio, json, logging, os
from typing import Optional
import aio_pika, aiormq
from .types import Event

_log = logging.getLogger("event.rabbitmq")
_log.info("🔔 importing RabbitMQ connector v2 (resilient)")


def _install_return_handler(chan: aio_pika.abc.AbstractChannel) -> None:
    """Silently drop Basic.Return messages regardless of aio-pika version."""
    cb = lambda *a, **kw: _log.debug("↩️  AMQP return dropped: %r %r", a, kw)
    if hasattr(chan, "add_on_return_callback"):
        chan.add_on_return_callback(cb)  # aio-pika ≥9
    elif hasattr(chan, "set_return_listener"):
        chan.set_return_listener(cb)     # aio-pika <9
    else:  # pragma: no cover - unexpected
        _log.debug("Channel %r lacks return callback hook", chan)

class RabbitMQBus:
    def __init__(self, amqp_url: str, exchange_name: Optional[str] = "events") -> None:
        self._url = amqp_url
        self._exchange_name = (exchange_name or "").strip()
        self._conn: Optional[aio_pika.RobustConnection] = None
        self._chan: Optional[aio_pika.RobustChannel] = None
        self._exchange: Optional[aio_pika.Exchange] = None
        self._ready_evt = asyncio.Event()
        self._lock = asyncio.Lock()

    async def start(self) -> None:
        async with self._lock:
            if self._conn and not self._conn.is_closed and self._chan and not self._chan.is_closed:
                if self._exchange_name and not self._exchange:
                    self._exchange = await self._chan.declare_exchange(
                        self._exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
                    )
                self._ready_evt.set()
                return

            self._ready_evt.clear()
            self._conn = await aio_pika.connect_robust(
                self._url, timeout=5.0,
                client_properties={"connection_name": "video-eventbus"},
            )
            self._chan = await self._conn.channel(publisher_confirms=False)
            await self._chan.set_qos(prefetch_count=32)

            # Drop any broker returns on the floor (defensive; mandatory=False already)
            _install_return_handler(self._chan)

            if self._exchange_name:
                self._exchange = await self._chan.declare_exchange(
                    self._exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
                )
                _log.info("RabbitMQ connected → %s (exchange=%s)", self._url, self._exchange_name)
            else:
                self._exchange = None
                _log.info("RabbitMQ connected → %s (default-exchange)", self._url)

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
            _install_return_handler(self._chan)
            if self._exchange_name:
                self._exchange = await self._chan.declare_exchange(
                    self._exchange_name, aio_pika.ExchangeType.TOPIC, durable=True
                )
            else:
                self._exchange = None
        self._ready_evt.set()
        return self._chan

    async def publish(self, evt: Event) -> None:
        body = json.dumps(evt.to_dict()).encode()
        rk = str(evt.topic)

        attempt, max_attempts, backoff = 0, 5, 0.25
        while True:
            attempt += 1
            try:
                chan = await self._ensure_channel()
                exchange = self._exchange if self._exchange is not None else chan.default_exchange
                await exchange.publish(
                    aio_pika.Message(body=body, content_type="application/json"),
                    routing_key=rk,
                    mandatory=False,  # ← prevents Basic.Return
                )
                return
            except (aiormq.exceptions.ChannelInvalidStateError,
                    aiormq.exceptions.ConnectionClosed,
                    aio_pika.exceptions.AMQPException) as e:
                if attempt >= max_attempts:
                    _log.warning("EventBus publish failed after %d attempts: %s", attempt, e)
                    raise
                _log.info("EventBus publish retry %d/%d (%.2fs): %s", attempt, max_attempts, backoff, e)
                await asyncio.sleep(backoff); backoff = min(backoff * 2, 2.0)

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

# Singleton
_BUS_SINGLETON: Optional[RabbitMQBus] = None

def get_rabbitmq_bus() -> RabbitMQBus:
    amqp_url = os.getenv("EVENT_BROKER_URL") or os.getenv("AMQP_URL")
    if not amqp_url:
        raise RuntimeError("EVENT_BROKER_URL/AMQP_URL is not set")
    exchange_name = os.getenv("EVENT_EXCHANGE", "events")
    global _BUS_SINGLETON
    if _BUS_SINGLETON is None:
        _BUS_SINGLETON = RabbitMQBus(amqp_url, exchange_name=exchange_name)
        _log.info("RabbitMQBus singleton created (exchange=%r)", exchange_name)
    return _BUS_SINGLETON
