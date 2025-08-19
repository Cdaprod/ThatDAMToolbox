# Video Service

Modular digital‑asset management for ingesting, processing and serving video and related media.  The package is split into clear layers so each part can run in isolation.

## Quickstart

```bash
# CLI – scan a folder and build batches
python -m video scan /path/to/media

# API – start the FastAPI server
VIDEO_DB_PATH=/tmp/media_index.sqlite3 \
EVENT_BROKER_URL=amqp://video:video@localhost:5672/ \
uvicorn video.api.main:app
```

## Layout

- [storage](storage/README.md) – pluggable persistence for media binaries and vectors
- [core](core/README.md) – artifact models, processing pipeline and event bus
- [modules](modules/README.md) – optional plug‑ins (DAM UI, ffmpeg console, capture, …)
- [web](web/README.md) – templates and static assets served by FastAPI
- [api](api/README.md) – REST interface exposing storage and plug‑ins
- [helpers](helpers/README.md) – small utilities such as batch indexing
- [models](models/README.md) – Pydantic models shared across layers

Each directory contains its own README with more details.

