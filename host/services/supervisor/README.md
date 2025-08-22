# supervisor

Control-plane service for agent registration, plans, and environment bootstrapping.

For a quick provisioning walkthrough, see [Provisioning Quickstart](../../../docs/provisioning.md).

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
- `SUPERVISOR_API_KEY` (static fallback; when set, most endpoints require `X-API-Key` but `GET /v1/nodes` remains open)
- `BUS_KIND` (e.g. `amqp` for RabbitMQ)
- `BROKER_URL` (AMQP connection string)

If `SUPERVISOR_API_KEY` is unset (default), all access is governed solely by
policy flags such as `POLICY_REQUIRE_AUTH_FOR_PLAN`.

## Endpoints (partial)

- `POST /v1/nodes/register`
- `POST /v1/nodes/plan`
- `POST /v1/nodes/heartbeat`
- `GET  /v1/nodes`
- `POST /v1/tenancy/plan`
- `GET  /v1/bootstrap/profile`
- `GET  /v1/leader`
- `POST /api/claims/new`
- `GET  /api/claims/{id}/watch`
- `POST /api/claims/fulfill`

### Claim tokens

`POST /api/claims/new` issues a one-time token and claim ID. Callers may
watch for fulfilment using Server-Sent Events at
`/api/claims/{id}/watch`, which emits periodic heartbeats until the
claim is fulfilled. To complete the flow send the ID and token to
`/api/claims/fulfill`.

## Plan Selection

`POST /v1/nodes/plan` loads YAML templates from `./plans`:

- `server.yaml` when `role_hint` is `server`.
- `camera-proxy.yaml` when `role_hint` is empty and the node reports `capabilities.video_devices >= 1`.

Each template defines the app `env`, `ports`, and `after` settings.

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
