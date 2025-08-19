# supervisor – AGENTS Guide

Scope: Control-plane API providing desired state, bootstrap, and leader lease.

- Endpoints under `/v1/` must remain backward compatible.
- Publish overlay events via RabbitMQ; avoid persistent state.
- Authenticate using `JWKS_URL` or `SUPERVISOR_API_KEY`.
- Default operations are non-destructive; require explicit intent for deletes.
- Run `go test ./...` for API and reconcile packages.
