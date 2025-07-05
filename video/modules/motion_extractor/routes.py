# video/modules/motion_extractor/routes.py
from typing import List
from fastapi import APIRouter, UploadFile, File
import tempfile, shutil, logging
from pathlib import Path

from .motion_extractor import MotionExtractor

router = APIRouter(prefix="/motion", tags=["motion"])
_log   = logging.getLogger("video.motion")

PUBLIC_FRAMES_DIR = Path("/workspace/web_frames")
PUBLIC_FRAMES_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/extract")
async def extract_motion(files: List[UploadFile] = File(...)):
    """
    Accept 1..N files sent as multipart-form "files".
    Returns a list with stats for each upload.
    """
    results = []

    for up in files:
        # persist upload to a temp file
        suffix   = Path(up.filename).suffix or ".mp4"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(up.file, tmp)
            tmp_path = Path(tmp.name)

        out_dir = PUBLIC_FRAMES_DIR / tmp_path.stem
        me      = MotionExtractor(tmp_path, output_dir=out_dir)
        saved   = me.extract()

        results.append({
            "filename"    : up.filename,
            "frames_saved": saved,
            "output_dir"  : f"/frames/{tmp_path.stem}"   # path we’ll expose
        })

    return {"results": results}

from fastapi.staticfiles import StaticFiles

# mount only if running under FastAPI (import guard avoids stdlib path issues)
try:
    from fastapi import FastAPI
    frames_app = FastAPI()
    frames_app.mount("/", StaticFiles(directory=PUBLIC_FRAMES_DIR), name="frames")
    router.mount("/frames", frames_app)     # → /motion/frames/…
except ImportError:
    pass