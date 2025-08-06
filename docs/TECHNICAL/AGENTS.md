# AGENTS.md -- ThatDAMToolbox Engineering Guide

### Repository URL: [Cdaprod/ThatDAMToolbox](github.com/Cdaprod/ThatDAMToolbox)

Welcome, Codex Agent (and human reviewers)!  
You are contributing to **ThatDAMToolbox**: a modular, containerized, open-source digital asset management system for live video, edge cameras, and ML workflows.

## TOP OF MIND:

- Always Wire, Avoid Rewrites At All Costs.
- Layers: Host (capture-daemon), Backend (video-api), Frontend (web-app).
- Host is device management and usable provided devices.
- Backend is core bootstrapped system + modular extensiblity.
- Frontend is Dashboard + Digital Asset Management + Recorder + Modular Extensions (have backend video.modules).
-

## 🏗️ Project Structure

- **data/**  
  Caches, databases, incoming media, logs, and per-module storage (DAM, explorer, hwcapture, motion_extractor, uploader).

- **docker/**  
  Dockerfiles and Compose configs for all services and components (capture-daemon, web-app, camera-agent, nginx, RabbitMQ, hotspot-installer, displays, weaviate, etc.).

- **host/**  
  Go-based system services and middleware (api-gateway, camera-proxy, capture-daemon, proxy, schema-registry, shared libraries).

- **video/**  
  Python CLI, server and module code for video ingest, processing, proxying, and ML workflows.

- **video/web/**  
  Legacy static assets and Jinja templates for dashboard and camera monitor.

- **public/**  
  Build-time web resources (favicons, SVGs, dot graphs).

- **docs/**  
  Architecture, deployment, events, device requirements, and agent guidelines.

- **scripts/**  
  Utility scripts for builds, event watching, database sync, camera setup, systemd services.

- **tests/**  
  Integration and unit tests (Go, Python, CLI, API client, end-to-end).

- **docker-compose.yaml**, **entrypoint.sh**, **Makefile**, **setup.py**, **requirements.txt**, **README.md**, **run_video.py**, **TUI & CLI entrypoints**  
  Root-level orchestration, tooling and documentation.

### capture-daemon

- Continuously discovers and manages camera devices
- Streams live video (HLS) and/or records to files
- Emits events (device lifecycle, recording start/stop) to a messaging system
- Exposes feature flags via `GET /features` (HLS preview, MP4 serving, WebRTC)
  Downstream services should query this endpoint at startup to decide whether to use
  HLS or WebRTC streaming.

### web-app

- Digital asset explorer for browsing recorded clips and media
- Live camera monitor with integrated recorder controls
- Unified dashboard for device health, streams and playback

### video-api

- Backend service for ingesting and indexing video files and metadata
- Generates thumbnails, time-based previews and playback URLs
- Exposes REST endpoints for search, retrieval and integration

## 🧪 Testing & Linting

- **Go**: Run `go test ./...` and `go vet ./...` before PRs.
- **Python**: Run `pytest` for `video-api` and modules.
- **Node/TS**: Run `yarn lint` and `yarn type-check` in `web-app`.
- All services must **start cleanly via Docker Compose**: `docker compose up --build` (CI will fail if not).

## ✍️ Code Style

- **Go**:
  - Use `gofmt`, `goimports`.
  - Package-level doc comments required for public APIs.
  - Avoid magic constants; use `config.go` or env vars.
  - Keep services stateless/idempotent where possible.
- **Python**:
  - Use Black for formatting, isort for imports.
  - CLI/REST APIs must have docstrings.
- **TypeScript/Next.js**:
  - Use Prettier (2-space), no semi-colons, single quotes.
  - Modular components go under `src/components/` or `src/modules/`.
  - **Never use the `/utils` directory for new logic** (deprecated).

## 🧩 Service Conventions

- **New service?** Add it under a new folder with Dockerfile, `go.mod`/`requirements.txt`, and a README.
- All services **communicate via RabbitMQ (events)**, and must gracefully reconnect.
- If you add a REST API:
  - Prefix internal APIs with `/internal/`
  - Health checks: `/health` must return 200 OK when ready.
- Device scanners should surface full **capabilities** in API responses, using v4l2 when possible.

## 🚦 Git & PR Rules

- **Branch names**: kebab-case, scoped by feature/service (e.g. `capture/scanner-v4l2`)
- **Commits**: Conventional commits, e.g. `[feat]`, `[fix]`, `[chore]`.
- **PR base**: `main` branch only.
- Link related issues in PR description.

## 🏗️ Build & Compose

- All new services **must be added to `docker-compose.yml`** with health checks.
- Sidecar containers (e.g. for Tailscale or overlay agents) must use shared networks as documented in Compose.

## 🚫 Do Not

- Never use `aws` or `boto3`.
- Never hardcode device capabilities in frontend or backend; always pull from dynamic device scan.
- Never add new code to `utils/` folders--refactor or create a module.
- Never push generated code or `.env` files.

## 🤖 Agent Responsibilities

- If device or camera hardware is not present, emit a `"system.alive"` or `"capture.ready"` event after broker connect, so UI/consumers can display a waiting state.
- Always write clear log messages for critical events, especially service startup, shutdown, device detection, and error states.
- When modifying camera scanning, API, or device broker logic, update and regenerate OpenAPI/Swagger docs in affected services.

## 📝 Docs & Comments

- Update this `AGENTS.md` and the affected service’s `README.md` if you introduce new configuration, environment variables, or APIs.
- All public endpoints and events must be documented in Markdown and code comments.

## 🏷️ Tags & Hashtags

- For sample social posts or in-code banners, use:  
  `#ThatDAMToolbox #devopsdad #hacktheplanet #opensource`

---

Thank you, Codex Agent! Help keep ThatDAMToolbox robust, testable, modular, and _unhackable_.
