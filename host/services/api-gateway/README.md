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

## Overlay endpoints
- `POST /agents/issue`
- `GET /.well-known/jwks.json`
- `GET /overlay/hints`
