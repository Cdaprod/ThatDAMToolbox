# api-gateway – AGENTS Guide

Scope: Central HTTP gateway, JWT issuer, and backend proxy.

- Serves static assets and proxies APIs; middleware lives under `pkg/`.
- JWKS and token issuance exposed at `/agents/issue` and `/.well-known/jwks.json`.
- Keep route definitions explicit; avoid hidden rewrites.
- Update docker-compose fragment when adding services or env vars.
- Run `go test ./...` for handlers and middleware.
