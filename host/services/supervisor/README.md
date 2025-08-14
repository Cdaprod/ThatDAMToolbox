# supervisor

Optional control-plane for agent registry and heartbeats.

## Usage

```
go run ./cmd/supervisor/main.go -addr :8070
```

Endpoints:
- `GET /health`
- `GET /agents`
- `POST /register`
- `POST /heartbeat`
