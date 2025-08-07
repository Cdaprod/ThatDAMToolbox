# Motion Extractor Module

Extracts frames that contain motion above a threshold.  Useful for quickly scanning surveillance or long recordings.

## Usage

```bash
# CLI
python -m video motion_extract --video in.mp4 --out frames/

# REST
curl -F file=@in.mp4 http://localhost:8080/motion/extract
```

## Integration Guide

The module auto‑registers CLI verbs and a FastAPI router when placed under `video/modules/motion_extractor`.  The core loader discovers it automatically.

The extractor itself lives in `extractor.py` and can be imported directly:

```python
from video.modules.motion_extractor.extractor import MotionExtractor
MotionExtractor("video.mp4").extract_with_stats()
```

