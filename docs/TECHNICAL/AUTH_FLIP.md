# Auth Flip: Auth0 (cloud) ⇄ Keycloak (on-prem)

## Quick Start

### Auth0
1) Create Application (Regular Web App).  
2) Allowed Callback: `http://localhost:8081/callback`  
3) Allowed Logout/Origins: `http://localhost:8081`, `http://localhost:3000`  
4) Export:
   - `AUTH0_ISSUER=https://<tenant>.us.auth0.com/`
   - `AUTH0_CLIENT_ID=...`
   - `AUTH0_CLIENT_SECRET=...`
5) Run:
```bash
docker compose -f docker/compose/auth-auth0.yaml up --build
```

### Keycloak (offline/dev)
1) Bring up seeded realm:
```bash
docker compose -f docker/compose/auth-keycloak.yaml up --build
```
2) Console: http://localhost:8089  (admin/admin)
   Realm: `thatdam`, Client: `web-app` (public + PKCE).
3) `auth-bridge` at http://localhost:8081

### Root Compose Profiles
Use the root `docker-compose.yaml` with profiles when you want the bridge and IdP managed together.

```bash
# Auth0
export COMPOSE_PROFILES=auth0
export OIDC_PROVIDER=auth0
docker compose up -d --build auth-bridge

# Keycloak
export COMPOSE_PROFILES=keycloak
export OIDC_PROVIDER=keycloak
docker compose up -d --build keycloak auth-bridge
```

## Service Contract (stable routes)
- `GET /health`
- `GET /login?next=/`
- `GET /callback`
- `POST /logout`
- `GET /session/me`  → normalized `{sub,email,name,roles,org?,exp}`
- Optional: `/.well-known/jwks.json` passthrough

Flip providers by changing compose file and env; routes remain unchanged.

