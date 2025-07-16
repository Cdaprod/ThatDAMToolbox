from pathlib import Path
from video.db import MediaDB
from video.probe import probe_media        # existing tech-metadata helper

DB = MediaDB()                             # singleton or DI – up to you

def index_file(path: str | Path, *, batch_name: str | None = None):
    """
    1. probe tech-metadata
    2. write DB row (or update existing SHA-1)
    3. enqueue preview / proxy generation if configured
    """
    path = Path(path)
    meta = probe_media(path)               # width, height, duration, …
    DB.upsert_file(path, batch_name, meta)