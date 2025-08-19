# runner – AGENTS Guide

Scope: Applies DesiredPlan from supervisor using deterministic executors.

- Communicate with supervisor over HTTP only; no docker-compose coupling.
- Executors live under `internal/runtime`; ensure idempotent start/stop.
- Respect app dependency ordering from DesiredPlan.
- Document new executors or plan fields in README.
- Run `go test ./...` before committing.
