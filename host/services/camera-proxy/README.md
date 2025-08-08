# camera-proxy

Transparent proxy exposing host cameras to containerized services.

## Build
```bash
docker build -t camera-proxy -f host/services/camera-proxy/Dockerfile .
```

## Run
```bash
docker run -p 8000:8000 camera-proxy
# or via compose fragment
docker compose -f host/services/camera-proxy/docker-compose.camera-proxy.yaml --profile camera-proxy up
```

## Configuration

- `ALLOWED_ORIGINS` – comma-separated list of allowed WebSocket origins (default: allow all)
- `CAPTURE_DAEMON_URL` – optional capture-daemon address (default `http://localhost:9000`)

Health check endpoint: `GET /healthz` returns `200 OK` when ready.

