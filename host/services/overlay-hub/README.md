# overlay-hub

A minimal hub relaying overlay agent traffic.

## Usage

```
go run ./cmd/overlay-hub/main.go -addr :8090
```

Endpoints:
- `GET /healthz`
- `GET /metrics`
- `POST /v1/register`
- `POST /v1/heartbeat`
- `POST /v1/negotiate`
- `POST /v1/publish`
- `POST /v1/subscribe`
- `POST /v1/reroute`
- `POST /v1/telemetry`
- `POST /v1/node/init`
