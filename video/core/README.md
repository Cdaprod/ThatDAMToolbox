# Core Layer

Orchestrates artifact ingestion, processing and event emission.  The core is used by the CLI, API and background tasks.

## Pipeline

1. `factory` builds artifacts or batches from file paths
2. `processor.pipeline` groups them and runs registered steps
3. `event.bus` publishes lifecycle events
4. `facades` adapt artifacts for specific requests

```python
from video.core.factory import build_from_paths
from video.core.processor import pipeline

arts = build_from_paths(["cam1/001.mp4", "cam2/002.mp4"])
pipeline.process_flat(arts)
```

## Subpackages

- [artifacts](artifacts/README.md)
- [event](event/README.md)
- [facades](facades/README.md)
- [proxy](proxy/README.md)

