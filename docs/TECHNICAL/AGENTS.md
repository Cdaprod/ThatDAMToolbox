# **That DAM Toolbox -- Engineering & Agent Guide**

*Last updated: 2025-08-06 · Maintainer: **David Cannan (@Cdaprod)***

### Repository URL: [Cdaprod/ThatDAMToolbox](github.com/Cdaprod/ThatDAMToolbox)

Welcome, **Codex Agents** (and human teammates)!  
This file equips you with everything required to ship safe, idempotent, idiomatic code inside the **That DAM Toolbox** monorepo.

-----

## 0 · Quick TL;DR for Busy Agents

```text
🟢  Work in-place • Be idempotent • Respect service boundaries
🟠  Tests + docs with every PR   • Prefer extending over rewriting
🔴  Never add utils/ folders, global state, or AWS/Boto3 deps
```

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
=======
-----

## Service Descriptions

### capture-daemon (host/services/capture-daemon/*)

- Continuously discovers and manages camera devices.
- Streams live video (HLS) and/or records to files.
- Emits events (device lifecycle, recording start/stop) to a messaging system.
- In development its located at `$REPO/host/services/capture-daemon`… will be relocated to `docker/host/services/capture-daemon` in production.
- Can receive and route additional video devices like from the "camera-agent" service.
- Written in golang.

### web-app (docker/web-app/*)

- The frontend nextjs ts application that is designed to be a PWA dashboard (Digital Asset Management Explorer + Camera Monitor/Recorder).
- Digital asset explorer for browsing recorded clips and media.
- Live camera monitor with integrated recorder controls.
- Unified dashboard for device health, streams and playback.
- Written in typescript.

### video-api (video/*)

- Backend service for ingesting and indexing video files and metadata.
- Generates thumbnails, time-based previews and playback URLs.
- Exposes REST endpoints for search, retrieval and integration.
- In dev its located at `$REPO/video/*` but will be in `docker/video/*` for production.
- Written in python.

### api-gateway (host/services/api-gateway/*)

- Central api gateway for services in this architecture.
- OpenAPI specs from other services to ensure alignment and type safety between them.
- Has yet to be "deployed" from repos root `/docker-compose.yaml`
- Written in golang.

### rabbitmq (docker/rabbitmq/*)

- System event broker
- All services read the connection string from `EVENT_BROKER_URL` (falling back to `AMQP_URL`)

### nginx (docker/nginx/*)

- Front facing gateway

### camera-agent (docker/camera-agent/*)

- An idiomatic, idempotent, self contained and independent service that produces a connected camera `/dev/videoN` stream from an isolated, yet discoverable and usable on local network.
- Can run on a raspberry pi zero w 2 and produces the video/audio stream on network (and to capture-daemon if capture-daemon is up, and just solo if its not).
- Can run independently on multiple devices, basically a better method of an IP Camera like URL Camera with browser preview.
- This helper image turns a plain Raspberry Pi (or any Debian-based host) into a self-contained "ThatDAMToolbox capture device relay".

### tft & touch display (docker/*-display/*)

- May be utilized in prod depending on hardware decisions I make in production.
- Such as: "tft-display/", "touch-display"

### hotspot-installer (docker/hotspot-installer/*)

- This helper image turns a plain Raspberry Pi (or any Debian-based host) into a self-contained "ThatDAMToolbox access point".

### weaviate (docker/weaviate/*)

- Vector database and long standing persistent service when deployed in prod

### minio (docker/minio/*)

- Object store and long standing persistent service when deployed in prod

-----
——

## 1 · Prime Directives (Rules the CI Bot Actually Enforces)

|#|Directive                                                                                                                                    |Rationale                                   |
|-|———————————————————————————————————————————————|———————————————|
|1|Idempotence everywhere — commands, DB migrations, API calls.                                                                                 |CI re-runs, k8s restarts, humans fat-finger.|
|2|Self-contained services — Dockerfile, deps, config & README live beside code.                                                                |`docker compose up svc` must Just Work™.    |
|3|Monorepo > micro-repos — share code only via clearly named shared modules: • Go → `host/shared` • Py → `video/core` • TS → `web-app/src/lib`.|Eliminates hidden coupling.                 |
|4|Idiomatic over clever — follow language standards (go fmt, Black, Prettier, ESLint).                                                         |Future-you > today’s hack.                  |
|5|APIs / Events only — services talk via REST, WebSocket, RabbitMQ; no cross-importing files.                                                  |Hot-swap & polyglot freedom.                |
|6|Minimal, meaningful tests — 1 “happy path” + 1 edge case; prefer integration over deep mocks.                                                |Catch regressions cheaply.                  |

### Commit / PR Checklist (copy-paste into description)

- [x] Change is self-contained & idempotent
- [ ] No unnecessary files / deps
- [ ] Tests added or updated
- [ ] Docs / OpenAPI / Events updated
- [ ] Conventional commit message  [feat], [fix], …)

——

## 2 ·  epository Cheat-Sheet ▶︎ where  hings live

|Layer         |Path(s)  x                                         |Language  |Purpose                                      |
|--------------|---------------------------------------------------|----------|---------------------------------------------|
|Host          |`host/services/*`                                  |Go        |Device discovery, API-gateway, proxy.        |
|Backend       |`video/`, `video/modules/*`                        |Python    |FastAPI ingest, ML workers.                  |
|Frontend      |`docker/web-app/src/*`                             |TypeScript|Next.js PWA dashboard & DAM UI.              |
|Infrastructure|`docker/compose/*.yaml`, root `docker-compose.yaml`|YAML      |Compose profiles (prod, touch-display, etc.).|
|Shared assets |`data/`, `public/`, `docs/`                        |misc      |Volumes, diagrams, markdown specs.           |

-----

## 3 · How to Add / Modify a Service (10-minute recipe)

1. **Scaffold under correct layer directory:**
   
   ```bash
   mkdir -p host/services/foo && cd $_
   cp ../_template/Dockerfile .
   ```
1. **Compose stub** → `docker/compose/foo.yaml` with health-check.
1. **Define APIs / events first;** update `docs/TECHNICAL/EVENTS.md` & OpenAPI if REST.
1. **Write minimal test** under `tests/`; use tmp dirs, never prod data.
1. **Run locally:** `docker compose --profile foo up --build`.
1. **Submit PR** using checklist above.

-----

## 4 · Event Bus Quick Reference (RabbitMQ topic events)

|Topic prefix|Publisher          |Typical fields        |
|------------|-------------------|----------------------|
|`capture.*` |capture-daemon (Go)|device, file, ts      |
|`video.*`   |video-api (Py)     |job_id, video_path, ts|
|`webapp.*`  |web-app (Next.js)  |action, user, ts      |

**Schema evolution:** add only new optional fields; never delete or repurpose.

-----

## 5 · Current "Top of Mind" Streams (If You Want to Help)

|Stream                          |Owner     |Status                                 |
|--------------------------------|----------|---------------------------------------|
|Route-path refactor in video-api|open      |see issue #142                         |
|Responsive frontend cleanup     |web-app   |`src/app/page.tsx` WIP                 |
|API-gateway rollout             |host layer|prototype compiling, not in compose yet|

-----
-----

## 🧪 Testing & Linting

- **Go**: Run `go test ./...` and `go vet ./...` before PRs.
- **Python**: Run `pytest` for `video-api` and modules.
- **Node/TS**: Run `yarn lint` and `yarn type-check` in `web-app`.
- All services must **start cleanly via Docker Compose**: `docker compose up --build` (CI will fail if not).

-----

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

-----

## 🧩 Service Conventions

- **New service?** Add it under a new folder with Dockerfile, `go.mod`/`requirements.txt`, and a README.
- All services **communicate via RabbitMQ (events)**, and must gracefully reconnect.
- If you add a REST API:
  - Prefix internal APIs with `/internal/`
  - Health checks: `/health` must return 200 OK when ready.
- Device scanners should surface full **capabilities** in API responses, using v4l2 when possible.

-----

## 🚦 Git & PR Rules

- **Branch names**: kebab-case, scoped by feature/service (e.g. `capture/scanner-v4l2`)
- **Commits**: Conventional commits, e.g. `[feat]`, `[fix]`, `[chore]`.
- **PR base**: `main` branch only.
- Link related issues in PR description.

-----

## 🏗️ Build & Compose

- All new services **must be added to `docker-compose.yml`** with health checks.
- Sidecar containers (e.g. for Tailscale or overlay agents) must use shared networks as documented in Compose.

-----

## 🚫 Do Not

- Never use `aws` or `boto3`.
- Never hardcode device capabilities in frontend or backend; always pull from dynamic device scan.
- Never add new code to `utils/` folders–refactor or create a module.
- Never push generated code or `.env` files.

-----

## 🤖 Agent Responsibilities

- If device or camera hardware is not present, emit a `"system.alive"` or `"capture.ready"` event after broker connect, so UI/consumers can display a waiting state.
- Always write clear log messages for critical events, especially service startup, shutdown, device detection, and error states.
- When modifying camera scanning, API, or device broker logic, update and regenerate OpenAPI/Swagger docs in affected services.

-----

## 📝 Docs & Comments

- Update this `AGENTS.md` and the affected service’s `README.md` if you introduce new configuration, environment variables, or APIs.
- All public endpoints and events must be documented in Markdown and code comments.

-----

## 7 · FAQ for Agents

**Q: Where do I put shared constants used by Go and Python?**  
A: You don’t. Expose via HTTP `/internal/config` endpoint or RabbitMQ event.

**Q: Can I generate TypeScript client code from OpenAPI?**  
A: Yes → output to `web-app/src/lib/api` and commit the generator command in Makefile.

**Q: Need a helper in two Python modules--duplicate or share?**  
A: Create `video/core/<helper>.py`, add unit test, update imports. Never copy-paste code.

-----

## 8 · Handy One-Liners

```bash
# Find inline React styles that still need refactor
rg 'style=\{[^}]+' docker/web-app/src | head

# Run fast tests
pytest -q -m "not slow"

# Hot-plug camera once (Go)
go run host/services/capture-daemon/cmd/main.go scan-once
```

-----

## 🏷️ Tags & Hashtags

For sample social posts or in-code banners, use:  
`#ThatDAMToolbox #devopsdad #hacktheplanet #opensource #Cdaprod`

-----

## Overlay Network Quickstart

```bash
# launch overlay stack
docker compose up -d overlay-hub api-gateway capture-daemon camera-proxy

# issue agent token
curl -s -X POST http://localhost:8080/agents/issue -d '{"agent_id":"cam1"}'

# register and send heartbeat
TOKEN=<paste token>
curl -H "Authorization: Bearer $TOKEN" -X POST http://localhost:8090/v1/register
curl -H "Authorization: Bearer $TOKEN" -X POST http://localhost:8090/v1/heartbeat
```

-----

## 9 · Contact

For help tag issues with `[agent-help]` or ping @Cdaprod on GitHub.  
Social hashtags: `#ThatDAMToolbox` · `#DevOpsDad`.

**General Principle:** Favor simplicity, resilience, and clarity.  
If in doubt, make it easier for the next person to reason about & run a service in isolation.

-----

Thank you, Codex Agent! Help keep ThatDAMToolbox robust, testable, modular, and _unhackable_.
