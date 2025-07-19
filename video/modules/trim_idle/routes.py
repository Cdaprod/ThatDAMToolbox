"""
/video/modules/trim_idle/routes.py

FastAPI router so the toolbox can do:

    from video.modules.trim_idle import router
    app.include_router(router)

POST `/trim_idle/` with *multipart/form-data*:
    file=<video>, method=ffmpeg|opencv, noise=..., freeze_dur=..., pix_thresh=...
Returns the trimmed file as attachment.
"""
from pathlib import Path
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import FileResponse
from .trimmer import TrimIdleProcessor
import tempfile
import uuid

router = APIRouter(prefix="/trim_idle", tags=["trim_idle"])


@router.post("/", summary="Trim idle frames from uploaded video")
async def trim_idle_endpoint(
    file: UploadFile = File(..., description="Input video"),
    method: str = Form("ffmpeg"),
    noise: float = Form(0.003),
    freeze_dur: float = Form(0.10),
    pix_thresh: float = Form(2.0),
):
    if not file.filename.lower().endswith((".mp4", ".mov", ".mkv", ".m4v")):
        raise HTTPException(status_code=415, detail="Unsupported media type")

    with tempfile.TemporaryDirectory() as td:
        src_path = Path(td) / file.filename
        src_path.write_bytes(await file.read())

        dst_path = src_path.with_stem(f"{src_path.stem}_trimmed_{uuid.uuid4().hex}")

        processor = TrimIdleProcessor(
            src_path,
            dst_path,
            method=method,
            noise=noise,
            freeze_dur=freeze_dur,
            pix_thresh=pix_thresh,
        )
        final = processor.run()

        return FileResponse(
            final,
            media_type="video/mp4",
            filename=final.name,
        )