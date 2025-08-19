# Artifacts

Domain objects representing media and batches.  Standard classes include `VideoArtifact`, `AudioArtifact`, `DocumentArtifact` and `BatchArtifact`.  All inherit from `base.Artifact` which handles IDs, state and event emission.

### Registry

`_registry.py` maps file extensions to artifact classes.  Modules register themselves via a `__register__` hook.

```python
# my_artifact.py
from video.core.artifacts import base

class GifArtifact(base.Artifact):
    ...

def __register__(register):
    register('.gif', GifArtifact)
```

Importing this module makes the new artifact available through the factory.

