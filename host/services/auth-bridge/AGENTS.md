# auth-bridge – AGENTS Guide

Scope: Minimal HTTP bridge exposing Auth0 or Keycloak auth endpoints.

- Handlers must remain stateless; rely on OIDC cookies/tokens only.
- Respect `OIDC_*` env vars; default provider is Auth0.
- Expose `/health`, `/session/me`, and login/logout routes; document additions.
- Keep internal logic under `internal/`; avoid cross-service imports.
- Test with `go test ./...` and update README for new config.
