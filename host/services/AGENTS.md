# Host Services – AGENTS Guide

Scope: Go-based host services for discovery, capture, proxying, and gateway duties.

- Follow repo-wide rules in `docs/TECHNICAL/AGENTS.md`.
- Each service is self-contained with its own `go.mod`, Dockerfile, tests, and README.
- Shared code lives under `./shared`; never import other services directly.
- Communicate via HTTP or RabbitMQ (`EVENT_BROKER_URL`/`AMQP_URL`); avoid global state.
- Keep code idempotent and side-effect free; updates require tests and docs.
- Run `go test ./...` in the modified service before committing.
