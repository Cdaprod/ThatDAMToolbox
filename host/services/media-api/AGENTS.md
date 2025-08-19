# media-api – AGENTS Guide

Scope: Minimal Go media API with asset endpoints and optional preview worker.

- Serve REST under `/v1/*`; health at `/api/v2/health`.
- Preview worker consumes `asset.ingested` when `PREVIEW_WORKER=1`.
- Use `BLOB_STORE_ROOT` for CAS paths under `derived/`.
- Handlers reside in `pkg/handlers`; keep storage logic service-local.
- Run `go test ./...` with `BROKER_URL=inproc` for worker tests.
