# video/README.md

## That DAM Toolbox

```
Updated directory layout (depth ≤ 1)
────────────────────────────────────
video/
├── __init__.py          # this file – high-level API
├── __main__.py          # universal entry-point (CLI ⇄ API)
├── api.py               # FastAPI app object (lazy import)
├── bootstrap.py         # first-run helpers & env checks
├── cli.py               # argparse + sub-commands
├── commands.py          # dataclass DTOs for CLI & TUI
├── config.py            # global settings, paths, env-vars
├── db.py                # SQLite interface + migrations
├── hwaccel.py           # optional FFmpeg HW acceleration helpers
├── paths.py             # canonical path helpers (XDG, iOS, etc.)
├── preview.py           # preview / proxy generation
├── probe.py             # tech-metadata extraction (codec, resolution…)
├── scanner.py           # multithreaded file walker + SHA-1 pipeline
├── server.py            # tiny stdlib HTTP fallback
├── sync.py              # Photos / iCloud / remote importers
├── tui.py               # rich-based TUI frontend
├── schema.sql           # DB schema & migrations
├── video.cfg            # sample INI config
├── video.1              # man-page (generated)
├── test_script.py       # quick self-test / smoke-run
# sub-packages (expand separately)
├── core/                # domain logic split into bounded contexts
├── dam/                 # digital-asset-management utilities
├── helpers/             # misc pure-stdlib helpers
├── models/              # pydantic / dataclass models
├── modules/             # plugin auto-discovery root
├── storage/             # storage back-ends (S3, MinIO, local…)
└── web/                 # static files & SPA frontend bundle
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