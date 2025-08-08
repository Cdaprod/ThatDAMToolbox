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


## WebRTC and HLS preview

Enable streaming features in the config or environment:

```yaml
features:
  webrtc:
    enabled: true
  hls_preview:
    enabled: true
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

