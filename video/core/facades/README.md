# Facades

Facades wrap artifacts with request‑specific context.  `VideoFacade` adds helper methods for building proxies or deriving paths without mutating the underlying artifact.

```python
from video.core.facades.video_facade import VideoFacade

facade = VideoFacade.from_path("clip.mp4", request_id="abc")
proxy = facade.to_proxy()
```

Facades are thin adapters – any heavy processing should remain on the artifact itself.

