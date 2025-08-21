# api-gateway

API gateway that fronts backend services and static assets.

## Build
```bash
docker build -t api-gateway -f host/services/api-gateway/Dockerfile .
```

## Run
```bash
docker run -p 8080:8080 api-gateway
# or via compose fragment
docker compose -f host/services/api-gateway/docker-compose.api-gateway.yaml --profile api-gateway up
```

### Logging

Configure via environment variables:

- `LOG_LEVEL` – debug|info|warn|error (default info)
- `LOG_FORMAT` – auto|json|text (default auto)
- `LOG_CALLER` – off|short|full (default short)
- `LOG_TIME` – off|rfc3339|rfc3339ms (default rfc3339ms)
- `LOG_NO_COLOR` – set to `1` to disable colored output
- `SRT_BASE_URL` – base SRT address advertised at `/api/registry/srt`

## Overlay endpoints
- `POST /agents/issue`
- `GET /.well-known/jwks.json`
- `GET /overlay/hints`
