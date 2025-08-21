# Auth Bridge Container

Builds the Go auth-bridge service for deployment.

## Usage
```bash
# build the image
docker build -f docker/auth-bridge/Dockerfile -t cdaprod/auth-bridge .
# run with default Auth0 settings
docker run -p 8081:8081 cdaprod/auth-bridge
```

## Environment
- `OIDC_PROVIDER` – `auth0` or `keycloak`
- `OIDC_ISSUER`
- `OIDC_CLIENT_ID` / `OIDC_CLIENT_SECRET`
- `OIDC_SCOPES` (default `openid profile email`)
- `AUTH_REDIRECT_BASE` (public base URL)
- `AUTH_COOKIE_DOMAIN`
- `TENANCY_URL` – membership lookup (optional)
- `ADDR` – listen address (default `:8081`)

## Testing
```bash
go test ./host/services/auth-bridge/...
```
