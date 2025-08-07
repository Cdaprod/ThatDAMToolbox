# Modules

Plug‑in system for optional features.  Any subfolder with a `module.cfg` is auto‑discovered when `video` is imported.  Modules may expose CLI commands, FastAPI routers and extra dependencies.

Available modules:

- [dam](dam/README.md) – embeddings and FAISS search
- [explorer](explorer/README.md) – folder listing APIs
- [ffmpeg_console](ffmpeg_console/README.md) – run ffmpeg commands from the UI
- [hwcapture](hwcapture/README.md) – hardware capture and streaming
- [motion_extractor](motion_extractor/README.md) – extract motion frames
- [trim_idle](trim_idle/README.md) – remove idle segments
- [uploader](uploader/README.md) – async file uploads

