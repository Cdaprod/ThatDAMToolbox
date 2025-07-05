# /video/api.py
import pkgutil, importlib
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import uuid
import logging
import json

from . import modules
from .cli import run_cli_from_json
from .web import templates, static

app = FastAPI(title="Video DAM API")
log = logging.getLogger("video.api")

# Expose /static/style.css, /static/app.js, …
app.mount("/static", static, name="static")

# ---------------------------------------------------------------------------
# Root HTML page  →  http://<host>:<port>/
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
async def home(request: Request):
    """
    Pretty HTML front-end (upload form, batch browser).
    Purely optional – JSON API routes still work as before.
    """
    # return templates.TemplateResponse("index.html", {"request": request})
    return templates.TemplateResponse("dashboard.html", {"request": request})

# ---------------------------------------------------------------------------
# Routing →  http://<host>:<port>/<path>
# ---------------------------------------------------------------------------

# In-memory job store
_jobs: Dict[str, Dict[str, Any]] = {}

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

# Health
@app.get("/health")
async def health():
    return {"status": "ok", "service": "video-api"}

# ── generic CLI proxy --------------------------------------------------------
class CLIRequest(BaseModel):
    """Arbitrary CLI step; must include an 'action' key."""
    action: str
    params: Dict[str, Any] = {}

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
    out = run_cli_from_json('{"action":"stats"}')
    return out

# Recent
@app.get("/recent")
async def recent(limit: int = 10):
    req = {"action": "recent", "limit": limit}
    out = run_cli_from_json(json.dumps(req))
    return out

# Scan directory
@app.post("/scan")
async def scan(req: ScanRequest):
    cmd = {"action": "scan", "root": req.directory, "workers": 4}
    return run_cli_from_json(json.dumps(cmd))

# Search
@app.post("/search")
async def search(q: str, limit: int = 50):
    cmd = {"action": "search", "q": q, "limit": limit}
    return run_cli_from_json(json.dumps(cmd))

# Batches
@app.get("/batches")
async def list_batches():
    cmd = {"action": "batches", "cmd": "list"}
    return run_cli_from_json(json.dumps(cmd))

@app.get("/batches/{batch_name}")
async def get_batch(batch_name: str):
    cmd = {"action": "batches", "cmd": "show", "batch_name": batch_name}
    return run_cli_from_json(json.dumps(cmd))

@app.post("/batches", status_code=202)
async def create_batch(req: BatchCreateRequest, bg: BackgroundTasks):
    job_id = str(uuid.uuid4())
    _jobs[job_id] = {"status":"pending", "result":None}

    def _worker():
        try:
            # 1) Pre-flight: transcode all paths to H.264
            for src in req.paths:
                dst = src.rsplit(".",1)[0] + "_INCOMING/" + src.split("/")[-1]
                trans_cmd = {"action":"transcode", "src":src, "dst":dst, "codec":"h264"}
                run_cli_from_json(json.dumps(trans_cmd))
            # 2) Now create the batch
            batch_cmd = {
                "action":"batches",
                "cmd":"create",
                "name":req.name,
                "paths":[p.rsplit(".",1)[0] + "_INCOMING/" + p.split("/")[-1]
                         for p in req.paths]
            }
            result = run_cli_from_json(json.dumps(batch_cmd))
            _jobs[job_id] = {"status":"completed", "result": result}
        except Exception as e:
            logger.exception("Batch create failed")
            _jobs[job_id] = {"status":"error", "result":{"error": str(e)}}

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
    cmd = {"action":"batches","cmd":"delete","batch_name":batch_name}
    return run_cli_from_json(json.dumps(cmd))

# Paths
@app.get("/paths")
async def list_paths():
    cmd = {"action":"paths","cmd":"list"}
    return run_cli_from_json(json.dumps(cmd))

@app.post("/paths")
async def add_path(name: str, path: str):
    cmd = {"action":"paths","cmd":"add","name":name,"path":path}
    return run_cli_from_json(json.dumps(cmd))

@app.delete("/paths/{name}")
async def remove_path(name: str):
    cmd = {"action":"paths","cmd":"remove","name":name}
    return run_cli_from_json(json.dumps(cmd))

# iOS sync
@app.post("/sync_album")
async def sync_album(album: str):
    cmd = {"action":"sync_album","root":None,"album":album}
    return run_cli_from_json(json.dumps(cmd))

# Backup
@app.post("/backup")
async def backup(source: str, destination: Optional[str] = None):
    cmd = {"action":"backup","backup_root":destination or "/backup","dry_run":False}
    return run_cli_from_json(json.dumps(cmd))
    
# ── auto-include plug-in routers --------------------------------------------
from . import modules   # namespace package

for mod in pkgutil.iter_modules(modules.__path__, prefix="video.modules."):
    if not mod.name.split('.')[-1].startswith("__"):
        m = importlib.import_module(mod.name)
        if hasattr(m, "router"):
            app.include_router(m.router)
            log.info("✔ added %s", mod.name)