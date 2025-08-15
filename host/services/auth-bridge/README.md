# auth-bridge

Minimal HTTP bridge exposing auth endpoints for Auth0 or Keycloak.

## Usage
```bash
OIDC_PROVIDER=auth0 go run ./cmd/auth-bridge
```

### Runner registration
Request a runner install script:
```bash
curl -X POST http://localhost:8081/runners/register -d '{"profile":"demo"}'
```

## Testing
```bash
go test ./cmd/auth-bridge
```
