# Helpers

Small utility modules:

- `artifact_bridge.py` – index a folder and produce a batch via the core pipeline
- `pydantic_compat.py` – compatibility layer between Pydantic v1 and v2

Example:

```python
from pathlib import Path
from video.helpers.artifact_bridge import index_folder_as_batch

batch_id = index_folder_as_batch(Path("media"))
```

