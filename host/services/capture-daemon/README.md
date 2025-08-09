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

Additional runtime options:

- `ICE_SERVERS` – comma-separated STUN/TURN URLs for WebRTC negotiation.
- `FFMPEG_HWACCEL` – extra ffmpeg args to enable hardware acceleration.

## Security

Set `AUTH_TOKEN` to require a bearer token on API requests. To serve HTTPS, provide `TLS_CERT_FILE` and `TLS_KEY_FILE` with the certificate and key paths.

