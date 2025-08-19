# capture-daemon – AGENTS Guide

Scope: Discovers cameras, records streams, and emits `capture.*` events.

- HTTP API on :9000 exposes device registry and recording control.
- Feature flags (`webrtc`, `hls_preview`, CAS ingest) are config-driven.
- Network sources configured under `capture.network_sources`.
- Runners and scanners live under `runner/` and `scanner/`; keep modular.
- Run `go test ./...` for device, overlay, and preview packages.
