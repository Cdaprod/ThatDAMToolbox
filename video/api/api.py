# /video/api.py
import pkgutil, importlib, uuid, logging, json

from pathlib import Path
from fastapi import (
    FastAPI,
    APIRouter,
    Depends,
    BackgroundTasks,
    HTTPException,
    Request,
)
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any, Annotated

from video.api import modules
from video.cli import run_cli_from_json
from video.web import templates, static

from video.helpers import index_folder_as_batch, model_validator
from video.core import get_manifest as core_get_manifest
from video.core.event import get_bus
from video.core.event.types import Event, Topic
from video.models import (
    Manifest,
    VideoArtifact,
    Slice,
    CardResponse,
    VideoCard,
    SceneThumb,
)
from video.storage.base import StorageEngine
from video.bootstrap import STORAGE
from video import modules

from video.ws import router as ws_router

origins = [
    "http://localhost:3000",  # your Next dev server
    # "https://your.production.url" # your prod domain
]

app = FastAPI(title="Video DAM API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()

log = logging.getLogger("video.api")

# ------------------------------------------------------------------------
# mount static, websocket, first-party routers exactly like before
app.mount("/static", static, name="static")
app.include_router(ws_router)
app.include_router(router)


@app.on_event("startup")
async def _emit_service_up() -> None:
    bus = get_bus()
    if bus:
        await bus.publish(Event(topic=Topic.VIDEO_API_SERVICE_UP))


# ---------------------------------------------------------------------------
# BaseModels
# ---------------------------------------------------------------------------
# In-memory job store
_jobs: Dict[str, Dict[str, Any]] = {}


class VideoArtifact(BaseModel):
    width: int
    height: int

    @model_validator(mode="after")
    def _ensure_non_empty(cls, m):
        if m.width == 0 or m.height == 0:
            raise ValueError("empty frame")
        return m


class FolderCreateRequest(BaseModel):
    folder: str  # absolute or relative path
    name: Optional[str]  # optional batch display-name


class ScanRequest(BaseModel):
    directory: str
    recursive: bool = True


class TranscodeRequest(BaseModel):
    src: str
    dst: Optional[str] = None
    codec: str = "h264"


class BatchCreateRequest(BaseModel):
    name: str
    paths: List[str]


class BatchUpsertRequest(BaseModel):
    paths: Optional[List[str]] = Field(
        default=None, description="Explicit media files to ingest"
    )
    folder: Optional[str] = Field(
        default=None, description="Scan this folder recursively"
    )
    name: Optional[str] = None  # optional display-name

    @model_validator(mode="after")
    def _exactly_one_source(self):
        if bool(self.paths) ^ bool(self.folder):
            return self
        raise ValueError("Provide *either* paths[] *or* folder, not both")


# ── generic CLI proxy --------------------------------------------------------
class CLIRequest(BaseModel):
    """Arbitrary CLI step; must include an 'action' key."""

    action: str
    params: Dict[str, Any] = {}


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _cli_json(cmd: dict[str, Any]) -> Any:
    """Run CLI helper and return parsed JSON"""
    return json.loads(run_cli_from_json(json.dumps(cmd)))


# ---------------------------------------------------------------------------
# Storage Engine Router
# ---------------------------------------------------------------------------


def get_store() -> StorageEngine:
    return STORAGE


# Use a *different* function name so we don’t shadow `core_get_manifest`
@router.get("/media/{sha1}", response_model=Manifest)
async def fetch_manifest(sha1: str, store: StorageEngine = Depends(get_store)):  # 🆕
    manifest = store.get_video(sha1)
    if manifest is None:
        raise HTTPException(status_code=404, detail="media not found")
    return manifest


app.include_router(router)

# ---------------------------------------------------------------------------
# Root HTML page  →  http://<host>:<port>/
# ---------------------------------------------------------------------------


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return FileResponse("video/web/static/favicon/favicon.ico")


@app.get("/", include_in_schema=False)
async def home(request: Request):
    """
    Pretty HTML front-end (upload form, batch browser).
    Purely optional – JSON API routes still work as before.
    """
    # return templates.TemplateResponse("index.html", {"request": request})
    return templates.TemplateResponse("dashboard.html", {"request": request})


@app.post("/cli")
def cli_proxy(req: CLIRequest):
    """POST JSON {action:.., params:{...}} → run_cli_from_json()"""
    step = {"action": req.action, **req.params}
    try:
        return json.loads(run_cli_from_json(json.dumps(step)))
    except Exception as e:
        log.exception("CLI proxy failed")
        raise HTTPException(status_code=500, detail=str(e))


# Stats
@app.get("/stats")
async def stats():
    return _cli_json({"action": "stats"})


# Recent
@app.get("/recent")
async def recent(limit: int = 10):
    return _cli_json({"action": "recent", "limit": limit})


# Scan directory
@app.post("/scan")
async def scan(req: ScanRequest):
    return _cli_json({"action": "scan", "root": req.directory, "workers": 4})


# Search
@app.post("/search")
async def search(q: str, limit: int = 50):
    return _cli_json({"action": "search", "q": q, "limit": limit})


# ---------------------------------------------------------------------------
# Batches
# ---------------------------------------------------------------------------
@app.get("/batches")
async def list_batches():
    return _cli_json({"action": "batches", "cmd": "list"})


@app.get("/batches/{batch_name}")
async def get_batch(batch_name: str):
    return _cli_json({"action": "batches", "cmd": "show", "batch_name": batch_name})


# --- single endpoint --------------------------------------------------------
@app.post("/batches", response_model=dict)
async def upsert_batch(req: BatchUpsertRequest, bg: BackgroundTasks):
    """
    • `paths`  – existing behaviour (transcode + legacy scanner)
    • `folder` – new fast Artifact pipeline
    """
    if req.folder:
        folder = Path(req.folder)
        if not folder.is_dir():
            raise HTTPException(400, f"{folder} is not a directory")

        batch_id = index_folder_as_batch(folder, batch_name=req.name)
        manifest = core_get_manifest(batch_id)
        if manifest is None:
            raise HTTPException(500, "batch processing failed")
        return manifest

    # ---------- legacy path-list branch (unchanged) ----------
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status": "pending", "result": None}

    def _worker():
        try:
            # 1) optional transcode
            for src in req.paths:
                dst = Path(src).parent / "_INCOMING" / Path(src).name
                trans_cmd = {
                    "action": "transcode",
                    "src": src,
                    "dst": str(dst),
                    "codec": "h264",
                }
                run_cli_from_json(json.dumps(trans_cmd))

            # 2) create batch the old way
            batch_cmd = {
                "action": "batches",
                "cmd": "create",
                "name": req.name,
                "paths": req.paths,
            }
            result = run_cli_from_json(json.dumps(batch_cmd))
            _jobs[job_id] = {"status": "completed", "result": result}
        except Exception as e:
            log.exception("Batch create failed")
            _jobs[job_id] = {"status": "error", "result": {"error": str(e)}}

    bg.add_task(_worker)
    return {"job_id": job_id, "status": "started"}


@app.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return job


@app.delete("/batches/{batch_name}")
async def delete_batch(batch_name: str):
    return _cli_json({"action": "batches", "cmd": "delete", "batch_name": batch_name})


@app.get("/batches/{batch_id}/cards", response_model=CardResponse)
async def batch_cards(batch_id: str, limit: int = 50, include_score: bool = False):
    """
    Return an object-browser friendly structure:
    artifact + a couple of L1 thumbnails per video.
    """
    manifest = core_get_manifest(batch_id)
    if manifest is None:
        raise HTTPException(404, "batch not found")

    cards: list[VideoCard] = []

    for art in manifest.artifacts[:limit]:
        # pull the first two scene thumbnails for each video…
        l1_slices = manifest.slices.get(art.sha1, [])
        thumbs: list[SceneThumb] = []
        for sl in l1_slices[:2]:  # take N slices
            thumb_url = f"/static/thumbs/{art.sha1}_{sl.start_time:.0f}.jpg"
            thumbs.append(SceneThumb(time=sl.start_time, url=thumb_url))

        score = None
        if include_score:
            # example: cosine similarity against a query vector you cached
            score = await similarity_lookup(art.sha1)  # your helper

        cards.append(VideoCard(artifact=art, scenes=thumbs, score=score))

    return CardResponse(batch_id=batch_id, items=cards)


# Paths
@app.get("/paths")
async def list_paths():
    return _cli_json({"action": "paths", "cmd": "list"})


@app.post("/paths")
async def add_path(name: str, path: str):
    return _cli_json({"action": "paths", "cmd": "add", "name": name, "path": path})


@app.delete("/paths/{name}")
async def remove_path(name: str):
    return _cli_json({"action": "paths", "cmd": "remove", "name": name})


# iOS sync
@app.post("/sync_album")
async def sync_album(album: str):
    return _cli_json({"action": "sync_album", "root": None, "album": album})


# Backup
@app.post("/backup")
async def backup(source: str, destination: Optional[str] = None):
    return _cli_json(
        {"action": "backup", "backup_root": destination or "/backup", "dry_run": False}
    )


# Health
@app.get("/health")
async def health():
    return {"status": "ok", "service": "video-api"}
