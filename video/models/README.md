# Models

Pydantic models exchanged between layers.  Key classes:

- `VideoArtifact` – physical media with metadata
- `Slice` – time‑bounded region extracted from a video
- `Manifest` – collection of artifacts and their slices
- `VideoCard` – lightweight card for UI browsing

## Example

```python
from video.models import Manifest, VideoArtifact, VideoCard

art = VideoArtifact(filename="clip.mp4", sha1="abc")
manifest = Manifest(artifacts=[art])
card = VideoCard(artifact=art, scenes=[])

print(manifest.model_dump_json(indent=2))
```

