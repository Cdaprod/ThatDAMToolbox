from fastapi import APIRouter, UploadFile, File, Form
from pathlib import Path
import tempfile
from .ffmpeg_console import run_ffmpeg_console

router = APIRouter(prefix="/ffmpeg", tags=["ffmpeg"])

@router.post("/console")
async def ffmpeg_console_api(
    file: UploadFile = File(...),
    cmd: str = Form(...),
    output_name: str = Form(None)
):
    # Save upload to a temp file
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=Path(file.filename).suffix)
    tmp.write(await file.read()); tmp.flush()

    # Optionally use output_name
    output_path = None
    if output_name:
        output_path = str(Path(tmp.name).with_name(output_name))

    # Run FFmpeg command (use {{input}}/{{output}})
    result = run_ffmpeg_console(
        video_path=tmp.name,
        cmd=cmd,
        output_path=output_path,
        capture_output=True
    )

    return {
        "ok": result["returncode"] == 0,
        "cmd": result["cmd"],
        "returncode": result["returncode"],
        "stdout": result["stdout"],
        "stderr": result["stderr"],
        "output_file": result["output_file"]
    }
    

@router.get("/history")
async def ffmpeg_history(limit: int = 20):
    # Your logic here, e.g., fetch last N ffmpeg commands from a log or DB
    return {"history": []}