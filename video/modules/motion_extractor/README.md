# /video/modules/motion_extractor/README.md

I’ll create a self-contained module that can be easily dropped into any Python application with a clean, simple API.​​​​​​​​​​​​​​​​

I’ve created a comprehensive drop-in module that can be easily integrated into any Python application. Here’s what makes it perfect for bolt-on integration:

## Key Features:

### **Simple Integration**

- **Single file**: Just drop `motion_extractor.py` into your project
- **No external config files**: Everything is self-contained
- **Multiple usage patterns**: Class-based, static methods, or convenience functions

### **Flexible API**

```python
# Option 1: Simple one-liner
from motion_extractor import extract_motion_frames
frames_saved = extract_motion_frames("video.mp4", "output_frames")

# Option 2: Quick static method
from motion_extractor import MotionExtractor
frames_saved = MotionExtractor.quick_extract("video.mp4")

# Option 3: Full control with class instance
extractor = MotionExtractor("video.mp4", motion_threshold=5000)
stats = extractor.extract_with_stats()
```

### **Production-Ready Features**

- **Comprehensive error handling**: Validates inputs and handles edge cases
- **Progress tracking**: Optional callback for long-running operations
- **Logging integration**: Uses your existing logger or creates its own
- **Path flexibility**: Accepts both strings and Path objects
- **Memory efficient**: Processes frames one at a time

### **Easy Configuration**

- **Sensible defaults**: Works out of the box with minimal setup
- **Configurable parameters**: All aspects can be customized
- **Validation**: Automatically validates all parameters

### **Integration Examples**

**Web Application**:

```python
from motion_extractor import MotionExtractor

def process_uploaded_video(video_path, user_id):
    extractor = MotionExtractor(
        video_path=video_path,
        output_dir=f"users/{user_id}/frames"
    )
    return extractor.extract_with_stats()
```

**CLI Application**:

```python
from motion_extractor import extract_motion_frames

# Simple CLI integration
frames_saved = extract_motion_frames(
    video_path=args.input,
    output_dir=args.output,
    progress_callback=lambda p: print(f"Progress: {p:.1f}%")
)
```

The module is completely self-contained with comprehensive documentation, examples, and can be used immediately in any Python project that needs motion detection capabilities.​​​​​​​​​​​​​​​​

---

# Building Module(s)

Yes -- you can drop fully-independent bolt-ons under

video/modules/<your-module>/ and they will "light-up" automatically as soon as Python imports video. Below is the minimal wrapper that turns your motion_extractor.py into a plug-in that adds one CLI verb and one REST endpoint without changing any core files.

⸻

1 Folder layout to add

video/
└─ modules/
   └─ motion_extractor/
      ├── __init__.py          # glue
      ├── extractor.py         # ← your long file, renamed for clarity
      ├── commands.py          # CLI integration
      └── routes.py            # FastAPI integration (optional)

(You already pasted the contents for extractor.py; keep it as-is.)

⸻

2 Glue file: video/modules/motion_extractor/__init__.py

"""
Motion-Extractor plug-in for the Video toolbox.

Adds:
• CLI:   `video motion_extract --video input.mp4 --out frames/`
• REST:  POST /motion/extract
"""

# 1) Ensure core discovers our new verb & router
from . import commands    # registers CLI verb via decorator
from . import routes      # exposes FastAPI router (if FastAPI path active)

# 2) Re-export convenience class for direct importers
from .extractor import MotionExtractor           # noqa: F401


⸻

3 CLI integration: video/modules/motion_extractor/commands.py

from pathlib import Path
from argparse import ArgumentParser, Namespace
from .extractor import MotionExtractor
from video.cli import register          # decorator from core

@register("motion_extract", help="extract motion frames from a video")
def cli_motion_extract(args: Namespace):
    """
    Usage example:
        python -m video motion_extract --video in.mp4 --out frames --fps 2
    """
    me = MotionExtractor(
        video_path=args.video,
        output_dir=args.out,
        motion_threshold=args.threshold,
        fps_sampling=args.fps
    )
    stats = me.extract_with_stats()
    print(stats)

# ---- let main CLI know what args we need --------------------
def add_parser(sub):                               # called by core (optional)
    p = sub.add_parser("motion_extract", help="motion-frame extractor")
    p.add_argument("--video", required=True, type=Path)
    p.add_argument("--out", default="motion_frames", type=Path)
    p.add_argument("--threshold", type=int, default=3000)
    p.add_argument("--fps", type=int, default=1)

(If your core CLI auto-discovers COMMAND_REGISTRY you don’t need add_parser; otherwise add a one-liner in build_parser() to call it for every plug-in that defines it.)

⸻

4 REST integration: video/modules/motion_extractor/routes.py

from fastapi import APIRouter, UploadFile, File
from pathlib import Path
import tempfile
from .extractor import MotionExtractor

router = APIRouter(prefix="/motion", tags=["motion"])

@router.post("/extract")
async def extract_motion(file: UploadFile = File(...)):
    # save upload to tmp
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
    tmp.write(await file.read()); tmp.flush()

    out_dir = Path(tmp.name).with_suffix("_frames")
    me = MotionExtractor(tmp.name, output_dir=out_dir)
    saved = me.extract()

    return {
        "frames_saved": saved,
        "output_dir": str(out_dir)
    }

The core video/api.py already auto-includes any plug-in that exposes router, thanks to the auto-loader snippet you added earlier:

for mod in pkgutil.iter_modules(__path__, prefix=f"{__name__}.modules."):
    m = importlib.import_module(mod.name)
    if hasattr(m, "router"):
        app.include_router(m.router)


⸻

5 Dependency note

Your extractor uses OpenCV.  Add it to a plug-in-specific requirements file or to the root:

opencv-python-headless>=4.10

If you prefer isolated deps:

video/modules/motion_extractor/requirements.txt

and document: pip install -r video/modules/motion_extractor/requirements.txt.

⸻

6 Test drive

# CLI
python -m video motion_extract --video sample.mp4 --fps 2

# REST (FastAPI path)
curl -F file=@sample.mp4 http://localhost:8080/motion/extract | jq

If you are running the stdlib server (no FastAPI) the CLI still works; the REST route simply isn’t present.

⸻

7 Docker

Nothing changes.  The auto-loader imports the module inside the container, so the new endpoint appears automatically when you rebuild:

docker compose build
docker compose up -d


⸻

Recap
	•	Drop your module under video/modules/<name>/.
	•	Inside it, expose CLI verbs via @register and optional add_parser().
	•	Expose router for FastAPI routes.
	•	Core auto-loader picks it all up -- no edits to core files.