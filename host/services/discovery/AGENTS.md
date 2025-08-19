# discovery – AGENTS Guide

Scope: Bootstraps hosts by locating supervisor, fetching plan, and applying services.

- `startup.sh` is the single entry; keep idempotent across reboots.
- Supports mDNS, Tailscale, and Serf backends via `DISCOVERY_BACKEND`.
- After registration, apply DesiredPlan and send heartbeats at `ttl/3`.
- Use shared logger; new backends live under `internal/`.
- Ensure `go test ./...` and Makefile targets stay current.
