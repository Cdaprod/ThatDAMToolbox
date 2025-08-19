# supervisor

Control-plane service for agent registration, plans, and environment bootstrapping.

## Usage

```bash
go run ./cmd/supervisor/main.go -addr :8070
```

Then start a runner pointing at the supervisor:

```bash
SUPERVISOR_URL=http://localhost:8070 RUNNER_EXECUTOR=docker \
  go run ./host/services/runner/cmd/runner
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

### DesiredPlan example

```json
{
  "version": 1,
  "node": "n1",
  "apps": [
    {"name": "rabbitmq", "kind": "docker", "cwd": "./docker/rabbitmq", "command": ["up", "-d"]},
    {"name": "api-gateway", "kind": "docker", "cwd": "./host/services/api-gateway", "command": ["up", "-d"], "after": ["rabbitmq"]}
  ]
}
```

## Catalog

```go
rt := reconcile.BuildIndex()
cat := rt.Catalog()
```

## Tests

```bash
go test ./host/services/supervisor/...
```
