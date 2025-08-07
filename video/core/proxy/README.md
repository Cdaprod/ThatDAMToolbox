# Proxy

`MediaProxyArtifact` is a flat JSON serialisable view of an artifact used for API responses or background workers.  It carries basic fields plus optional technical metadata.

```python
from video.core.facades.video_facade import VideoFacade

facade = VideoFacade.from_path("clip.mp4")
proxy = facade.to_proxy()
print(proxy.model_dump())
```

Keep proxy models dependency‑free so they can be imported without bringing heavy video libraries.

