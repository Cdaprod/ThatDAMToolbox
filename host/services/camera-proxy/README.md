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

