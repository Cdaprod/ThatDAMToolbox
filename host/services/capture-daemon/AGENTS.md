# capture-daemon – AGENTS Guide

Scope: Discovers cameras, records streams, and emits `capture.*` events.

- HTTP API on :9000 exposes device registry and recording control.
- Feature flags (`webrtc`, `hls_preview`, CAS ingest) are config-driven.
- Network sources configured under `capture.network_sources`.
- Optional TSN mode configured under `tsn.*` (interface, queue, ptp_grandmaster);
  the daemon refuses to start if validation fails.
- Runners and scanners live under `runner/` and `scanner/`; keep modular.
- Run `go test ./...` for device, overlay, and preview packages.
