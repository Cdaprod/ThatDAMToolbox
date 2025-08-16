# Event Bus

Lightweight pub/sub system used inside the core.  The default bus runs in‑process; `rabbitmq_connector.py` provides an optional RabbitMQ transport.

Middleware functions in `middleware.py` can observe or mutate events.  Handlers register themselves in `handlers.py` and are looked up by topic.

```python
from video.core.event.bus import get_bus, Event, Topic

bus = get_bus()

@bus.subscribe(Topic.VIDEO_ADDED)
async def on_added(evt: Event):
    print("new video", evt.data)

await bus.publish(Event(topic=Topic.VIDEO_ADDED, data={"sha1": "abc"}))
```

