# supervisor

Control-plane service for agent registration, plans, and environment bootstrapping.

## Usage

```bash
go run ./cmd/supervisor/main.go -addr :8070
```

## Configuration

- `POLICY_ALLOW_ANONYMOUS_PROXY`
- `POLICY_REQUIRE_AUTH_FOR_PLAN`
- `POLICY_REQUIRE_AUTH_FOR_BOOTSTRAP`
- `JWKS_URL` (JWKS endpoint for JWT validation)
- `SUPERVISOR_API_KEY` (static fallback)

## Endpoints (partial)

- `POST /v1/nodes/register`
- `POST /v1/nodes/plan`
- `POST /v1/nodes/heartbeat`
- `GET  /v1/bootstrap/profile`
- `GET  /v1/leader`

## Tests

```bash
go test ./host/services/supervisor/...
```
