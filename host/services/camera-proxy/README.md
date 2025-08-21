# camera-proxy

Transparent proxy exposing host cameras to containerized services.

For provisioning instructions, see [Provisioning Quickstart](../../../docs/provisioning.md).

## Capture sources

[capture-daemon](../capture-daemon/README.md) can ingest streams from both
local devices and network broadcasts, while camera-proxy only exposes hardware
attached to the host. For remote network feeds, refer to the capture-daemon's
[network broadcast section](../capture-daemon/README.md#network-broadcast).

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

### Viewer

The image bundles a small web viewer served at `/viewer/`:

```bash
curl -I http://localhost:8000/viewer/
# or open http://localhost:8000/viewer/ in a browser
```

The static files live under `/srv/viewer` inside the container. Override `VIEWER_DIR` to serve a different directory.

### Metrics

Encoder telemetry (frame delays and drops) is exposed at `/metrics` on the same port:

```bash
curl http://localhost:8000/metrics
```

Prometheus can scrape this endpoint for monitoring.

## Remote deployment

Build for older ARM boards by targeting `linux/arm/v6` and setting `GOARM=6`:

```bash
docker build --platform linux/arm/v6 \
  --build-arg GOARM=6 \
  -t camera-proxy -f host/services/camera-proxy/Dockerfile .
```

When running remotely, point the proxy at the host running the rest of the stack via:

```bash
HOST=192.168.1.100
docker run -p 8000:8000 \
  -e EVENT_BROKER_URL=http://$HOST:8080 \
  -e OVERLAY_HUB_URL=http://$HOST:8081 \
  -e CAPTURE_DAEMON_URL=http://$HOST:9000 \
  camera-proxy
```

## Configuration

- `ALLOWED_ORIGINS` – comma-separated list of allowed WebSocket origins (default: allow all)
- `CAPTURE_DAEMON_URL` – optional capture-daemon address (default `http://localhost:9000`)
- `CAPTURE_DAEMON_TOKEN` – bearer token for capture-daemon requests
- `TLS_CERT_FILE`/`TLS_KEY_FILE` – serve HTTPS using these credentials
- `ICE_SERVERS` – comma-separated STUN/TURN URLs for WebRTC (optional)
- `FFMPEG_HWACCEL` – extra ffmpeg args for hardware acceleration (e.g. `cuda -hwaccel_device 0`)
- `VIEWER_DIR` – path to static viewer files served at `/viewer/` (default `/srv/viewer`)
- `METRICS_PORT` – port for Prometheus metrics (default `8001`)

The proxy uses an adaptive bitrate ladder:

```yaml
abr_ladder:
  - resolution: 1920x1080
    fps: 60
    bitrate: 12000000
  - resolution: 1920x1080
    fps: 30
    bitrate: 8000000
  - resolution: 1280x720
    fps: 30
    bitrate: 4000000
```

- `SRT_BASE_URL` – base SRT address used by `/srt?device=` (optional)

### Logging

Configure log output with environment variables:

- `LOG_LEVEL` – debug|info|warn|error (default info)
- `LOG_FORMAT` – auto|json|text (default auto)
- `LOG_CALLER` – off|short|full (default short)
- `LOG_TIME` – off|rfc3339|rfc3339ms (default rfc3339ms)
- `LOG_NO_COLOR` – set to `1` to disable colored output

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

