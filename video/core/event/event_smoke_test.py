from video.core.event import get_bus
from video.core.event.types import Event, Topic
import asyncio, os

os.environ.setdefault("EVENT_BROKER_URL", "amqp://video:video@localhost:5672/")

async def main():
    bus = get_bus()              # lazy-init
    await bus.publish(Event(topic=Topic.LIFECYCLE_STARTUP, payload={"msg": "hello"}))
    await bus.close()

asyncio.run(main())