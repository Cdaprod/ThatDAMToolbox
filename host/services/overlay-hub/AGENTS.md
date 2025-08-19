# overlay-hub – AGENTS Guide

Scope: Lightweight hub relaying overlay agent registration and heartbeats.

- HTTP API on :8090: `/v1/register`, `/v1/heartbeat`, `/v1/negotiate`, `/healthz`, `/metrics`.
- Holds an in-memory registry; no persistent storage.
- Agents authenticate with tokens from api-gateway.
- Future QUIC relay should remain optional and modular.
- Run `go test ./...` for handlers and registry logic.
