# API Package

FastAPI application exposing the toolbox over HTTP.  Modules that expose a `router` are automatically included at startup.

## Running

```bash
uvicorn video.api.app:create_app --factory --reload
```

`modules.py` contains the auto‑loader that imports any `video.modules.*` package.

