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
- `CAPTURE_DAEMON_TOKEN` – bearer token for capture-daemon requests
- `TLS_CERT_FILE`/`TLS_KEY_FILE` – serve HTTPS using these credentials

Health check endpoint: `GET /healthz` returns `200 OK` when ready.


## Streaming

The `/stream?device=` endpoint relays camera feeds:

```bash
curl 'http://localhost:8000/stream?device=/dev/video0'
```

Devices discovered from a capture-daemon use `daemon:` prefixes. These redirect to its HLS preview:

```bash
curl -i 'http://localhost:8000/stream?device=daemon:cam1'
# -> Location: http://localhost:9000/preview/cam1/index.m3u8
```

If WebRTC negotiation with the daemon fails, the proxy serves an MJPEG stream directly so browsers and tools can still view the feed.

