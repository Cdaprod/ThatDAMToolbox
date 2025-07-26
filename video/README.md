# video/README.md

## technically.. this directory would exist under [docker/video](/docker/video/)

## That DAM Toolbox

```
.
├── api.py
├── bootstrap.py
├── cli.py
├── commands.py
├── config.py
├── core
│   ├── artifacts
│   │   ├── audio.py
│   │   ├── base.py
│   │   ├── batch.py
│   │   ├── document.py
│   │   ├── __init__.py
│   │   └── video.py
│   ├── auto.py
│   ├── facades
│   │   ├── __init__.py
│   │   └── video_facade.py
│   ├── factory.py
│   ├── ingest.py
│   ├── __init__.py
│   ├── processor.py
│   ├── proxy
│   │   └── media_proxy.py
│   └── README.md
├── dam
│   └── __pycache__
│       ├── __init__.cpython-312.pyc
│       └── main.cpython-312.pyc
├── db.py
├── helpers
│   ├── artifact_bridge.py
│   ├── __init__.py
│   └── pydantic_compat.py
├── hwaccel.py
├── __init__.py
├── __main__.py
├── models
│   └── __init__.py
├── modules
│   ├── dam
│   │   ├── commands.py
│   │   ├── __init__.py
│   │   ├── models
│   │   │   ├── embeddings.py
│   │   │   ├── faiss_store.py
│   │   │   ├── hierarchy.py
│   │   │   ├── __init__.py
│   │   │   └── storage.py
│   │   ├── module.cfg
│   │   ├── README.md
│   │   ├── routes.py
│   │   └── services.py
│   ├── explorer
│   │   ├── commands.py
│   │   ├── __init__.py
│   │   └── routes.py
│   ├── ffmpeg_console
│   │   ├── commands.py
│   │   ├── ffmpeg_console.py
│   │   ├── __init__.py
│   │   ├── README.md
│   │   ├── requirements.txt
│   │   └── routes.py
│   ├── hwcapture
│   │   ├── audiosync.py
│   │   ├── camerarecorder.py
│   │   ├── commands.py
│   │   ├── hwcapture.py
│   │   ├── __init__.py
│   │   ├── module.cfg
│   │   ├── __pycache__
│   │   │   ├── __init__.cpython-312.pyc
│   │   │   └── routes.cpython-312.pyc
│   │   ├── README.md
│   │   ├── requirements.txt
│   │   ├── routes.py
│   │   └── tracker.py
│   ├── __init__.py
│   ├── motion_extractor
│   │   ├── commands.py
│   │   ├── __init__.py
│   │   ├── module.cfg
│   │   ├── motion_extractor.py
│   │   ├── __pycache__
│   │   │   ├── commands.cpython-312.pyc
│   │   │   ├── __init__.cpython-312.pyc
│   │   │   ├── motion_extractor.cpython-312.pyc
│   │   │   └── routes.cpython-312.pyc
│   │   ├── README.md
│   │   ├── requirements.txt
│   │   └── routes.py
│   ├── __pycache__
│   │   └── __init__.cpython-312.pyc
│   ├── trim_idle
│   │   ├── commands.py
│   │   ├── __init__.py
│   │   ├── __pycache__
│   │   │   ├── __init__.cpython-312.pyc
│   │   │   └── routes.cpython-312.pyc
│   │   ├── routes.py
│   │   └── trimmer.py
│   └── uploader
│       ├── cli.py
│       ├── __init__.py
│       └── routes.py
├── paths.py
├── preview.py
├── probe.py
├── README.md
├── scanner.py
├── schema.sql
├── server.py
├── storage
│   ├── auto.py
│   ├── base.py
│   ├── __pycache__
│   │   ├── auto.cpython-312.pyc
│   │   └── base.cpython-312.pyc
│   ├── README.md
│   └── wal_proxy.py
├── sync.py
├── test_script.py
├── tui.py
├── video.1
├── video-2.cfg
├── video.cfg
├── web
│   ├── __init__.py
│   ├── static
│   │   ├── app.js
│   │   ├── components
│   │   │   ├── batch-card.js
│   │   │   ├── dam-client.js
│   │   │   ├── dam-explorer.js
│   │   │   ├── explorer.js
│   │   │   ├── ffmpeg-console.js
│   │   │   ├── live-preview.js
│   │   │   ├── object-renderer.js
│   │   │   ├── upload-card.js
│   │   │   └── video-card.js
│   │   ├── favicon
│   │   │   ├── android-chrome-192x192.png
│   │   │   ├── android-chrome-512x512.png
│   │   │   ├── apple-touch-icon.png
│   │   │   ├── favicon-16x16.png
│   │   │   ├── favicon-32x32.png
│   │   │   ├── favicon.ico
│   │   │   └── site.webmanifest
│   │   └── styles.css
│   └── templates
│       ├── base.html
│       ├── camera-monitor.html
│       ├── dam-modules.html
│       ├── dashboard.html
│       └── partials
│           ├── _analytics_card.html
│           ├── _batch_card.html
│           ├── _batch_ops_card.html
│           ├── _explorer_card.html
│           ├── _ffmpeg_card.html
│           ├── _library_card.html
│           ├── _motion_card.html
│           ├── _preview_card.html
│           ├── _search_card.html
│           ├── _sidebar.html
│           ├── _upload_card.html
│           ├── _videos_card.html
│           └── _witness_card.html
└── ws.py

31 directories, 152 files

```

Layered–let’s discuss the concrete structure into clear architectural abstraction layers, mapping your existing modules to an evolving, modular DAM architecture.

⸻

## 🔧 1. Physical / Storage Layer

**Purpose:** persistence of media binaries.

- `storage/base.py`, `storage/auto.py`: abstraction over storage implementations.
- `core/artifacts/*`: artifact models referencing stored files.

This is your foundation–handling raw asset ingestion, storage durability, proxies, and previews. Matches the "foundation" in DBGallery’s four-layer model.

⸻

## 📦 2. Metadata & Indexing Layer

**Purpose:** searchable metadata, embeddings, FAISS index.

- `dam/models/storage.py`, `embeddings.py`, `faiss_store.py`, `hierarchy.py`

This aligns with the "organized metadata taxonomy" pillar. Your FAISS index and embeddings build the metadata search backbone.

⸻

## 🧠 3. Core Business Logic / Asset Management Layer

**Purpose:** orchestrate ingestion, processing, workflows.

- `core/processor.py`, `factory.py`, `facades/video_facade.py`, `proxy/media_proxy.py`
- Module-level processing in `modules/*` (ffmpeg, motion, trimming)

These encapsulate operations: transcoding, proxy generation, batch workflows. They implement the DAM "business layer," managing process orchestration.

⸻

## 🧩 4. Integration / API Layer

**Purpose:** expose asset services and integrations.

- `api.py`, `cli.py`, `commands.py`, `dam/router.py`, `web/routes*.js`, `web/*.html`

Your API and CLI supply asset ingestion, search, operations endpoints. `router.py` and web UI form a headless/API-first approach.

⸻

## 🎨 5. Presentation / UI Layer

**Purpose:** user-facing interfaces.

- `web/static/**/*.js`, `web/templates/**/*.html`
- `tui.py`, `server.py`, `cli.py` (UI surfaces)

These present dashboards, pickers, previews–completely decoupled from storage and core logic.

⸻

## 🔗 6. Consumer / External Systems Layer

**Purpose:** third-party integration.

- Integration points not fully implemented yet–could include CMS, analytics, or publishing consumers calling your API.

⸻

## 📊 Visual Summary

```
[External Consumers]
        ↑
[Presentation / UI Layer] -- web UI, TUI, CLI
        ↑
[Integration / API Layer] -- api.py, router.py, commands.py
        ↑
[Core Asset Management Layer] -- processor.py, facades, modules
        ↑
[Metadata & Indexing Layer] -- embeddings, faiss, hierarchy
        ↑
[Physical Storage Layer] -- storage/*, artifacts
```

⸻

## 🛠️ Steps to Strengthen Modularity

1. **Enforce clear layer boundaries**
- e.g., Core / processor should not directly access DB–use a metadata-api interface instead.
1. **Define explicit contracts/interfaces**
- Establish interfaces for storage, metadata, processing operations – support interchangeable implementations.
1. **Expand headless service**
- Fully decouple API from UI, moving web logic into separate frontend repo.
1. **Extract reusable entity logic**
- Use Entity Abstraction–e.g., asset interfaces usable by CLI, API, and UI without duplication.
1. **Enforce layered dependencies**
- Core may depend on metadata and storage, but never on presentation or UI.

⸻

## ✅ Next Architecture Enhancements

- **Metadata governance:** add schema management, validation, and controlled vocabularies for better searchability.
- **AI-powered auto-tagging:** integrate ML into core/processor to auto-generate tags, feeding into embeddings and search indexes.
- **Workflow layer:** introduce BPM or state machines (approval, archiving).
- **Publish/integration SDKs:** optional SDK for external systems (CMS, analytics).

⸻

## 🧩 ToC-Guided Next Steps

1. Formalize interfaces between layers (example: storage API, metadata API).
1. Modularize your `modules/` layer into mappable process services.
1. Add governance and auto-tagging workflows.
1. Implement versioning, rights, and lifecycle management.

Which area should we deep-dive into next?