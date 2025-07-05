from fastapi import APIRouter, UploadFile, File
from pathlib import Path
import tempfile
import logging
from .motion_extractor import MotionExtractor


router = APIRouter(prefix="/motion", tags=["motion"])
_log    = logging.getLogger("video.motion")

PUBLIC_FRAMES_DIR = Path("/workspace/web_frames")

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