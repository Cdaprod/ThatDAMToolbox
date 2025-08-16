# **That DAM Toolbox – Engineering & Agent Guide**

*Last updated: 2025-08-06 · Maintainer: **David Cannan (@Cdaprod)***

### Repository URL: [Cdaprod/ThatDAMToolbox](https://github.com/Cdaprod/ThatDAMToolbox)

Welcome, **Codex Agents** (and human teammates)!  
This document explains the key principles and details you’ll need to develop and maintain the **That DAM Toolbox** monorepo.

-----

## 0 · Quick TL;DR for Busy Agents

🟢  Work in-place - Be idempotent - Respect service boundaries
🟠  Tests + docs with every PR - Prefer extending over rewriting
🔴  Never add utils/ folders, global state, or AWS/Boto3 deps

## TOP OF MIND:

- Avoid rewrites; wire new features into existing services.
- auth-bridge flips between Auth0 and Keycloak; see `AUTH_FLIP.md`.
- Architecture layers:
    – Host: Go services for device discovery, streaming, and proxying (capture-daemon, camera-proxy).
    – Backend: Python-based video-api and media modules.
    – Frontend: Next.js web-app for asset management and live monitoring.
- Control-plane oriented: Discovery asks Supervisor for a plan; Supervisor serves desired state (plan + environment profile).
- Overlay network (overlay-hub) for low-latency agent connectivity and registration.
- All messaging uses RabbitMQ with the unified EVENT_BROKER_URL (fallback to AMQP_URL).
- Idempotent bootstrap: storage → broker → index (non-destructive by default).
- Air-gapped ready: artifacts and profiles can be hosted on-LAN (MinIO or Supervisor static).

## 🏗️ Project Structure

- data/ – Persistent caches, databases, incoming media, logs, and per-module storage.
- docker/ – Dockerfiles and Compose configs for all services and components: capture-daemon, camera-agent,
              web-app, nginx, RabbitMQ, hotspot-installer, overlay-hub, displays, weaviate, etc.
- host/ – Go services and shared middleware:
      – api-gateway   – central HTTP gateway and JWKS issuer.
      – camera-proxy  – live device virtualization and streaming with fallback to WebRTC or MJPEG.
      – capture-daemon– device scanner and recorder.
      – discovery     – role/plan handshake, local applier, idempotent bootstrap of environment.
      – overlay-hub   – register/heartbeat server and (future) QUIC relay.
      – supervisor    – control-plane API (plan, environment profile, leader lease, events).
      – shared        – common middleware, event bus, overlay client, logx, supervisor client.
- video/ – Python CLI, FastAPI server, and pluggable modules for ingest, indexing, and ML workflows.
- video/web/ – Legacy web templates and static assets.
- public/ – Build-time assets like favicons, SVGs, and diagrams.
- docs/ – Architectural guides, deployment docs, event definitions, device requirements, and this guide.
- scripts/ – Build utilities, event watch scripts, DB sync, camera setup, systemd unit templates.
- tests/ – Go/Python/TS integration and unit tests for core services.
- Root-level orchestration: docker-compose.yaml, entrypoint.sh, Makefile, setup.py, requirements.txt, README.md, run_video.py, CLI/TUI entrypoints.

---

### supervisor

- Purpose: single source of truth for **desired state**.
- Exposes:
  – /v1/nodes/{register|plan|heartbeat} – per-node role & service set.
  – /v1/bootstrap/{profile,status,events} – environment reconcile contract.
  – /v1/leader{,/claim,/candidates} – leader lease + scoring.
- Publishes AMQP events: overlay.register, overlay.heartbeat, overlay.plan, overlay.leader, overlay.bootstrap.*.
- Non-destructive by default; destructive ops require explicit "intent".

### discovery

1. **Single Entry Point:** `./startup.sh start` on any machine.
2. **Locate Control Plane:** mDNS `_thatdam._tcp.local` → CLOUD_CONTROL_URL (→ optional tailnet hints).
3. **Handshake:** POST /v1/nodes/register → POST /v1/nodes/plan → write `cluster.json`.
4. **Apply Plan:** start/stop services to match `services[]` for the node (container or binary runner).
5. **Idempotent Bootstrap (Environment Profile):**
   – Storage: ensure buckets → versioning → lifecycle → tags (no deletes).
   – Broker: declare exchanges/queues/bindings (re-declare safe).
   – Index: ensure classes → add missing properties (no drops).
6. **Heartbeat:** POST /v1/nodes/heartbeat at `ttl/3`. On 401/403 re-register; on 404 re-locate.

### capture-daemon

- Discovers and manages camera devices via v4l2.
- Streams live video (HLS) and/or records to files.
- Emits capture.* events for device lifecycle and recording events.
- Feature flags via GET /features (e.g. HLS, MP4, WebRTC).
- Dev path: host/services/capture-daemon/ (prod under docker/host/services/capture-daemon/).

### camera-proxy

- Proxies and virtualizes cameras across the overlay; complements capture-daemon.
- Registers and heartbeats to supervisor; exposes health and features.

### web-app

- Next.js TypeScript PWA for DAM browsing and camera monitor.
- Drag-and-drop ingest, live preview, batch processing, modular extensions.
- Builds to static assets (docker/web-app/build) served via nginx.

### video-api

- FastAPI service for ingesting and indexing media files.
- Thumbnails, previews, playback URLs; REST (/scan, /search, /motion/extract, …).
- **Scope:** service-local bootstrap only (DB migrations, module init). **No cluster-wide setup** (moved to discovery).

### api-gateway

- Unified entry point + JWT issuing.
- JWKS at `/.well-known/jwks.json` and token endpoints (POST /agents/issue).
- Proxies API requests; enforces security middleware.

### overlay-hub

- Agent register/heartbeat via /v1/register and /v1/heartbeat.
- Holds a volatile registry; future: QUIC relay.
- Agents set OVERLAY_HUB_URL; tokens issued by api-gateway.

### rabbitmq

- Central event broker; services read EVENT_BROKER_URL (fallback AMQP_URL).
- Default creds: video:video on vhost /.

### nginx

- Edge HTTP; proxies video-api, api-gateway, and web-app.
- Templates and TLS under docker/nginx/.

### tft & touch display

- Optional small displays for monitoring/control; see docker/tft-display and docker/touch-display.

### hotspot-installer

- Ansible-based image to configure a Raspberry Pi as a self-contained Wi-Fi access point.

### weaviate

- Vector DB for semantic search when enabled by profile.

### minio

- S3-compatible object store for storage and archival.

---

## Control-Plane Bootstrap & Self-Healing (TL;DR)
- **Leader scoring:** Supervisor ranks nodes (CPU/RAM/NET/DISK/GPU/thermal/devices) and issues a lease with hysteresis.
- **Promotion:** If a better candidate out-scores the leader by threshold for K intervals, Supervisor orchestrates a safe handover:
  prepare → advertise new leader (mDNS + /v1/leader) → flip plans → drain → demote.
- **Solo/Cluster:** Any node can run solo. When peers appear, discovery re-handshakes and joins the cluster automatically.
- **Air-gapped:** Profiles/artifacts hosted on-LAN; agents never require public internet.

---

## Ports & Adapters (optional services are pluggable)
- ObjectStorage (FS default; MinIO optional)  
- EventBus (in-proc default; RabbitMQ optional)  
- VectorIndex (in-mem default; Weaviate optional)  
Discovery selects adapters from env; reconcilers are idempotent and non-destructive.

---

1 · Prime Directives (CI Rules)

#   Directive                                             Rationale
1   Idempotence everywhere (commands, DB migrations,      CI reruns, k8s restarts, fat fingers.
    API calls).
2   Self-contained services: Dockerfile, dependencies,    `docker compose up <service>` must Just Work™.
    config & README live beside code.
3   Monorepo > micro-repos: share code only via clearly   Avoid hidden coupling.
    named modules (host/shared, video/core, web-app/src/lib).
4   Idiomatic over clever: go fmt, Black, Prettier,       Future-you > today’s hack.
    ESLint.
5   APIs / Events only: services talk via REST,           Hot-swap & polyglot freedom.
    WebSocket, RabbitMQ; no file cross-imports.
6   Minimal, meaningful tests: one "happy path" + one     Catch regressions cheaply.
    edge case; prefer integration tests.

Commit / PR Checklist
- Change is self-contained & idempotent.  
- No unnecessary files or dependencies added.  
- Tests added or updated.  
- Docs / OpenAPI / Events updated.  
- Conventional commit message (feat, fix, …).
⸻

2 · Repository Cheat Sheet

Layer	Path(s)	Language	Purpose
Host	host/services/*	Go	Device discovery, API gateway, overlay hub.
Backend	video/, video/modules/*	Python	FastAPI ingest, ML workers.
Frontend	docker/web-app/src/*	TypeScript	Next.js PWA dashboard & DAM UI.
Infrastructure	docker/compose/*.yaml, root docker-compose.yaml	YAML	Compose profiles (prod, touch-display, overlay).
Shared assets	data/, public/, docs/	misc	Volumes, diagrams, markdown specs.


⸻

3 · How to Add or Modify a Service (10‑minute recipe)
	1.	Scaffold under the correct layer directory:

mkdir -p host/services/new-service && cd "$_"
cp ../_template/Dockerfile .


	2.	Compose stub → docker/compose/new-service.yaml with health check.
	3.	Define APIs/events first; update docs/TECHNICAL/EVENTS.md and OpenAPI if REST.
	4.	Write minimal tests under tests/, using temp directories and mocks.
	5.	Run locally: docker compose --profile new-service up --build.
	6.	Submit PR using the checklist above.

⸻

4 · Event Bus Quick Reference

Topic prefix	Publisher	Typical fields
capture.*	capture-daemon	device, file, ts
video.*	video-api	job_id, video_path, ts
webapp.*	web-app	action, user, ts
overlay.*	overlay-hub	agent_id, status, ts

Schema evolution: Always add new optional fields; never delete or repurpose existing ones. See docs/TECHNICAL/EVENTS.md for full specs.

⸻

5 · Current "Top of Mind" Streams

Stream	Owner	Status
Route-path refactor in video-api	open	see issue #142
Responsive frontend cleanup	web-app	src/app/page.tsx WIP
API-gateway rollout (incl. JWKS, agents)	host layer	prototype compiling
Overlay transport channel implementation	overlay-hub	planned; heartbeats working


⸻

🧪 Testing & Linting
	-	Go: run go test ./... and go vet ./... before PRs.
	-	Python: run pytest under video/ and module directories.
	-	Node/TS: run yarn lint and yarn type-check in web-app.
	-	Docker Compose: docker compose up --build must start all services.
	-	New services must include a /health endpoint for health checks in CI.

⸻

✍️ Code Style
	-	Go: Use gofmt and goimports. Package-level doc comments required. Avoid magic constants--put them in config.go or read from env.
	-	Python: Use black and isort. Every REST handler and CLI must have a docstring.
	-	TypeScript/Next.js: Use Prettier with 2‑space indent, no semicolons, single quotes. Place new components under src/components/ or src/modules/. Do not use utils/ for new logic.

⸻

🧩 Service Conventions
	-	New service? Add under its own folder with a Dockerfile, go.mod or requirements.txt, and a README.md explaining purpose and environment variables.
	-	All services use RabbitMQ via EVENT_BROKER_URL; if unset, fallback to AMQP_URL.
	-	When adding a REST API:
	-	Prefix internal APIs with /internal/.
	-	Provide a /health endpoint returning 200 OK when ready.
	-	Device scanners should surface full capabilities in API responses, using v4l2 and/or USB.

⸻

🚦 Git & PR Rules
	-	Branch names: use kebab-case with scope (e.g. capture/scanner-v4l2).
	-	Commits: follow Conventional Commits ([feat], [fix], [chore], etc.).
	-	PR base: always main.
	-	Link related issues in the PR description using Fixes #123.

⸻

🏗️ Build & Compose
	-	New services must be added to docker-compose.yaml with health checks.
	-	Use Compose profiles to opt‑in services (e.g. "overlay-hub", "camera-proxy").
	-	Shared networks: use damnet. For host-mode (nginx), avoid port clashes by using profiles or overrides.

⸻

🚫 Do Not
	-	Don't import AWS or boto3; all storage/services are local or via other providers (e.g., MinIO).
	-	Don't hardcode device capabilities; query capture-daemon or device API.
	-	Don't put new code under utils/; refactor to modules.
	-	Don't push generated code or .env files to source control.

⸻

🤖 Agent Responsibilities
	-	On startup, if no cameras are found, emit a capture.ready event after connecting to the broker so UI can indicate waiting state.
	-	Write clear logs for startup, shutdown, device detection, registration and errors.
	-	When modifying camera scan, API, or event logic, update and regenerate OpenAPI and Swagger docs.

⸻

📝 Docs & Comments
	-	Update this AGENTS.md and the affected service's README.md whenever new configuration variables, endpoints, or events are introduced.
	-	Document all public endpoints and events in Markdown and code comments.

⸻

7 · FAQ for Agents

|Topic prefix|Publisher          |Typical fields        |
|------------|-------------------|----------------------|
|`capture.*` |capture-daemon (Go)|device, file, ts      |
|`video.*`   |video-api (Py)     |job_id, video_path, ts|
|`webapp.*`  |web-app (Next.js)  |action, user, ts      |
Where do I put shared constants used by Go and Python?
Expose them via HTTP (GET /internal/config) or publish on RabbitMQ rather than cross‑import.

Can I generate TypeScript client code from OpenAPI?
Yes – run the generator via yarn run generate-api, output to web-app/src/lib/api, and commit.

Need a helper in two Python modules--duplicate or share?
Create it in video/core/<helper>.py, add unit tests, and import; never copy-paste.

|Stream                          |Owner     |Status                                 |
|--------------------------------|----------|---------------------------------------|
|Route-path refactor in video-api|open      |see issue #142                         |
|Responsive frontend cleanup     |web-app   |`src/app/page.tsx` WIP                 |
|API-gateway rollout             |host layer|prototype compiling, not in compose yet|
⸻

8 · Handy One-Liners

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

# Run fast tests (Py)
pytest -q -m "not slow"

# Hot-plug camera once (Go)
go run host/services/capture-daemon/cmd/main.go scan-once

# Issue overlay agent token (once JWKS/token API is live)
curl -s -X POST http://localhost:8080/agents/issue -d '{"agent_id":"cam1"}'


⸻

🏷️ Tags & Hashtags

Use these for social posts or in-code banners:
#ThatDAMToolbox #devopsdad #hacktheplanet #opensource #Cdaprod

⸻

Overlay Network Quickstart

The overlay network allows agents (capture-daemon, camera-proxy) to register and send heartbeats to the overlay hub, enabling NAT traversal and future QUIC streaming.

# Start overlay services locally
docker compose up -d overlay-hub api-gateway capture-daemon camera-proxy

# Issue a short-lived token for an agent (requires api-gateway in your stack)
curl -s -X POST http://localhost:8080/agents/issue -d '{"agent_id":"cam1"}'

# Use that token to register and send heartbeats
TOKEN=<paste_token>
curl -H "Authorization: Bearer $TOKEN" -X POST http://localhost:8090/v1/register
curl -H "Authorization: Bearer $TOKEN" -X POST http://localhost:8090/v1/heartbeat

For production, configure OVERLAY_HUB_URL on agents and ensure api-gateway publishes JWKS keys at /.well-known/jwks.json.

⸻

9 · Contact

For help tag issues with [agent-help] or ping @Cdaprod on GitHub.
Social tags: #ThatDAMToolbox · #DevOpsDad.

General Principle: Keep things simple, resilient, and clear.  Always think about how the next person will run your service in isolation.

⸻

Thank you, Codex Agent! Together we'll keep That DAM Toolbox robust, testable, modular, and unhackable.