# `video/core`

## Internal Application Logic

### How to use processor.py

```py
from video.core.factory   import build_from_paths
from video.core.processor import pipeline             # the singleton

paths = ["cam1/001.mp4", "cam1/002.mp4", "cam2/003.mov"]
artefacts = build_from_paths(paths)

# One call → grouped by parent dir → processed
batches = pipeline.process_flat(artefacts)

for b in batches:
    print(b.to_dict()["results"])
```  