# **That DAM Toolbox – Engineering & Agent Guide**

*Last updated: 2025-08-06 · Maintainer: **David Cannan (@Cdaprod)***

### Repository URL: [Cdaprod/ThatDAMToolbox](https://github.com/Cdaprod/ThatDAMToolbox)

Welcome, **Codex Agents** (and human teammates)!  
This document explains the key principles and details you’ll need to develop and maintain the **That DAM Toolbox** monorepo.

-----

## 0 · Quick TL;DR for Busy Agents

🟢  Work in-place • Be idempotent • Respect service boundaries
🟠  Tests + docs with every PR   • Prefer extending over rewriting
🔴  Never add utils/ folders, global state, or AWS/Boto3 deps

- Open/Closed Principle
- Loose Coupling High Cohesion
- Idempotently Agnostic Services to run independently but centralized in top layer(s)

## TOP OF MIND:
	•	Avoid rewrites; wire new features into existing services.
	•	Architecture layers:
	•	Host: Go services for device discovery, streaming, and proxying (capture-daemon, camera-proxy).
	•	Backend: Python-based video-api and media modules.
	•	Frontend: Next.js web-app for asset management and live monitoring.
	•	Use the overlay network (overlay-hub) for low-latency agent connectivity and registration.
	•	All messaging uses RabbitMQ with the unified EVENT_BROKER_URL (fallback to AMQP_URL).

## 🏗️ Project Structure
	•	data/ – Persistent caches, databases, incoming media, logs, and per-module storage.
	•	docker/ – Dockerfiles and Compose configs for all services and components: capture-daemon, camera-agent, web-app, nginx, RabbitMQ, hotspot-installer, overlay-hub, displays, weaviate, etc.
	•	host/ – Go services and shared middleware:
	•	api-gateway – central HTTP gateway and JWKS issuer.
	•	camera-proxy – live device virtualization and streaming with fallback to WebRTC or MJPEG.
	•	capture-daemon – device scanner and recorder.
	•	overlay-hub – register/heartbeat server and (future) QUIC relay.
	•	shared – common middleware, event bus, overlay client.
	•	video/ – Python CLI, FastAPI server, and pluggable modules for ingest, indexing, and ML workflows.
	•	video/web/ – Legacy web templates and static assets.
	•	public/ – Build-time assets like favicons, SVGs, and diagrams.
	•	docs/ – Architectural guides, deployment docs, event definitions, device requirements, and this guide.
	•	scripts/ – Build utilities, event watch scripts, DB sync, camera setup, systemd unit templates.
	•	tests/ – Go/Python/TS integration and unit tests for core services.
	•	Root-level orchestration: docker-compose.yaml, entrypoint.sh, Makefile, setup.py, requirements.txt, README.md, run_video.py, CLI/TUI entrypoints.

### capture-daemon
	•	Discovers and manages camera devices via v4l2.
	•	Streams live video (HLS) and/or records to files.
	•	Emits capture.* events for device lifecycle and recording events.
	•	Provides feature flags via GET /features (e.g. HLS, MP4, WebRTC).
	•	Exposed in development at host/services/capture-daemon/ (production under docker/host/services/capture-daemon/).

### web-app
	•	Next.js TypeScript application; PWA dashboard for DAM browsing and camera monitor.
	•	Supports drag‑and‑drop ingest, live preview, batch processing, and modular extensions.
	•	Compiles to static assets (docker/web-app/build) served via nginx.

### video-api
	•	FastAPI service for ingesting and indexing media files.
	•	Generates thumbnails, previews, and playback URLs.
	•	Exposes REST endpoints (/scan, /search, /motion/extract, etc.).
	•	Located at video/ in development; future production images build under docker/video/.

### api-gateway
	•	Unified entry point for backend services and JWT issuing.
	•	Hosts JWKS at /.well-known/jwks.json and token endpoints (POST /agents/issue).
	•	Proxies API requests and enforces security middleware.
	•	Currently built but not yet integrated in root Compose; see /host/services/api-gateway.

### rabbitmq
	•	Central event broker; all services read connection from EVENT_BROKER_URL.
	•	Default credentials: video:video on vhost /.

### nginx
	•	Edge HTTP server; proxies requests to video-api, api-gateway, and web-app.
	•	Configured in docker/nginx/ with templates and TLS certificates.

### camera-agent
	•	Lightweight Python service to turn any device into a networked camera.
	•	Autodiscovers gateways via mDNS or GATEWAY_URL, registers itself, then streams JPEG frames over WebSocket.
	•	Useful on Raspberry Pi Zero 2 W to produce /dev/videoN streams for capture-daemon.

### overlay-hub
	•	New service that registers agents and receives heartbeats via /v1/register and /v1/heartbeat.
	•	Holds a registry of active agents; future versions will relay QUIC channels.
	•	Agents (capture-daemon or camera-proxy) must set OVERLAY_HUB_URL to point to this hub.
	•	An agent must request a JWT token from api-gateway before registration.

### tft & touch display
	•	Optional hardware: small displays for monitoring or control; see docker/tft-display and docker/touch-display.

### hotspot-installer
	•	An Ansible-based image to configure a Raspberry Pi as a self-contained Wi‑Fi access point.

### weaviate
	•	Vector database for AI-powered semantic search.
	•	Used when video modules require vector embeddings (if enabled).

### minio
	•	S3-compatible object store for storage and archival.

⸻

1 · Prime Directives (CI Rules)

#	Directive	Rationale
1	Idempotence everywhere (commands, DB migrations, API calls).	CI reruns, k8s restarts, fat fingers.
2	Self-contained services: Dockerfile, dependencies, config & README live beside code.	docker compose up service must Just Work™.
3	Monorepo > micro-repos: share code only via clearly named modules (host/shared, video/core, web-app/src/lib).	Avoid hidden coupling.
4	Idiomatic over clever: follow go fmt, Black, Prettier, ESLint.	Future-you > today's hack.
5	APIs / Events only: services talk via REST, WebSocket, RabbitMQ; no file cross-imports.	Hot‑swap & polyglot freedom.
6	Minimal, meaningful tests: one "happy path" + one edge case; prefer integration tests.	Catch regressions cheaply.

Commit / PR Checklist
	•	Change is self-contained & idempotent.
	•	No unnecessary files or dependencies added.
	•	Tests added or updated.
	•	Docs / OpenAPI / Events updated.
	•	Conventional commit message (feat, fix, …).

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
	•	Go: run go test ./... and go vet ./... before PRs.
	•	Python: run pytest under video/ and module directories.
	•	Node/TS: run yarn lint and yarn type-check in web-app.
	•	Docker Compose: docker compose up --build must start all services.
	•	New services must include a /health endpoint for health checks in CI.

⸻

✍️ Code Style
	•	Go: Use gofmt and goimports. Package-level doc comments required. Avoid magic constants--put them in config.go or read from env.
	•	Python: Use black and isort. Every REST handler and CLI must have a docstring.
	•	TypeScript/Next.js: Use Prettier with 2‑space indent, no semicolons, single quotes. Place new components under src/components/ or src/modules/. Do not use utils/ for new logic.

⸻

🧩 Service Conventions
	•	New service? Add under its own folder with a Dockerfile, go.mod or requirements.txt, and a README.md explaining purpose and environment variables.
	•	All services use RabbitMQ via EVENT_BROKER_URL; if unset, fallback to AMQP_URL.
	•	When adding a REST API:
	•	Prefix internal APIs with /internal/.
	•	Provide a /health endpoint returning 200 OK when ready.
	•	Device scanners should surface full capabilities in API responses, using v4l2 and/or USB.

⸻

🚦 Git & PR Rules
	•	Branch names: use kebab-case with scope (e.g. capture/scanner-v4l2).
	•	Commits: follow Conventional Commits ([feat], [fix], [chore], etc.).
	•	PR base: always main.
	•	Link related issues in the PR description using Fixes #123.

⸻

🏗️ Build & Compose
	•	New services must be added to docker-compose.yaml with health checks.
	•	Use Compose profiles to opt‑in services (e.g. "overlay-hub", "camera-proxy").
	•	Shared networks: use damnet. For host-mode (nginx), avoid port clashes by using profiles or overrides.

⸻

🚫 Do Not
	•	Don't import AWS or boto3; all storage/services are local or via other providers (e.g., MinIO).
	•	Don't hardcode device capabilities; query capture-daemon or device API.
	•	Don't put new code under utils/; refactor to modules.
	•	Don't push generated code or .env files to source control.

⸻

🤖 Agent Responsibilities
	•	On startup, if no cameras are found, emit a capture.ready event after connecting to the broker so UI can indicate waiting state.
	•	Write clear logs for startup, shutdown, device detection, registration and errors.
	•	When modifying camera scan, API, or event logic, update and regenerate OpenAPI and Swagger docs.

⸻

📝 Docs & Comments
	•	Update this AGENTS.md and the affected service's README.md whenever new configuration variables, endpoints, or events are introduced.
	•	Document all public endpoints and events in Markdown and code comments.

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