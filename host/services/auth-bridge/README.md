# auth-bridge

Minimal HTTP bridge exposing auth endpoints for Auth0 or Keycloak.

## Usage
```bash

# run with Auth0 (default)
OIDC_PROVIDER=auth0 go run ./cmd/auth-bridge
```

### Endpoints
- `GET /health`
- `GET /session/me`
- `POST /runners/register`
- `GET /login`
- `GET /callback`
- `POST /logout`
- `POST /pair/start`
- `GET /pair/poll`

### Environment
- `OIDC_PROVIDER` – `auth0` or `keycloak`
- `OIDC_ISSUER` – OIDC issuer URL
- `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET`
- `OIDC_SCOPES` – requested scopes (default `openid profile email`)
- `AUTH_REDIRECT_BASE` – public URL for callbacks (default `http://localhost:8081`)
- `AUTH_COOKIE_DOMAIN` – cookie domain (default `localhost`)
- `TENANCY_URL` – base URL for Tenancy service to resolve memberships
- `ADDR` – listen address (default `:8081`)

See [docs/TECHNICAL/AUTH_FLIP.md](../../docs/TECHNICAL/AUTH_FLIP.md) for compose profiles.

## Testing
```bash
go test ./...
```
