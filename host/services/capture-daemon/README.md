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


## Network sources

Configure remote streams so they appear alongside `/dev/video*` devices:

```yaml
capture:
  network_sources:
    lobbycam: rtsp://192.168.1.10/stream
    parking: webrtc://example/stream
```

These IDs can be previewed like any physical device:

```
http://localhost:9000/preview/lobbycam/index.m3u8
```


## WebRTC and HLS preview

Enable streaming features in the config or environment:

```yaml
features:
  webrtc:
    enabled: true
  hls_preview:
    enabled: true
capture:
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

Negotiate a WebRTC session using curl:

```bash
curl -X POST http://localhost:9000/webrtc/offer \
  -H 'Content-Type: application/json' \
  -d '{"sdp":$(cat offer.json)}'
```

For OBS or any HLS client, add a media source pointing to:

```
http://localhost:9000/preview/<device>/index.m3u8
```

## CAS ingest

Recordings can be deduplicated and stored by hash. Set `BLOB_STORE_ROOT` to a
writable directory and the runner will move each finished MP4 into a
content‑addressable path (`blobs/sha256/..`). An `asset.ingested` event is
published with the catalog metadata, and a tiny seek index is written under
`indexes/<hash>.json`.

```
export BLOB_STORE_ROOT=/tmp/blobs
go run ./cmd/capture-daemon
```

Additional runtime options:

- `ICE_SERVERS` – comma-separated STUN/TURN URLs for WebRTC negotiation.
- `FFMPEG_HWACCEL` – extra ffmpeg args to enable hardware acceleration.
- `SRT_BASE_URL` – base SRT address used by `/srt?device=`.

### Logging

Set these variables to control log output:

- `LOG_LEVEL` – debug|info|warn|error (default info)
- `LOG_FORMAT` – auto|json|text (default auto)
- `LOG_CALLER` – off|short|full (default short)
- `LOG_TIME` – off|rfc3339|rfc3339ms (default rfc3339ms)
- `LOG_NO_COLOR` – set to `1` to disable colored output

## Security

Set `AUTH_TOKEN` to require a bearer token on API requests. To serve HTTPS, provide `TLS_CERT_FILE` and `TLS_KEY_FILE` with the certificate and key paths.

## Metrics

Prometheus metrics, including encoder frame delay and drop counts, are served at `/metrics` when metrics are enabled in the configuration (defaults to port `9001`).

```bash
curl http://localhost:9001/metrics
```

