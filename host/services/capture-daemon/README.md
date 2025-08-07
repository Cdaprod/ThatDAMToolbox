# capture-daemon

Discovers cameras and records streams with optional previews.

## Build
```bash
docker build -t capture-daemon -f host/services/capture-daemon/Dockerfile .
```

## Run
```bash
docker run -p 9000:9000 capture-daemon
# or via compose fragment
docker compose -f host/services/capture-daemon/docker-compose.capture-daemon.yaml --profile capture-daemon up
```

