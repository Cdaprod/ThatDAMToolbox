# camera-proxy

Small proxy that discovers local cameras and relays them to a capture-daemon via WebRTC.
If WebRTC negotiation fails the service falls back to serving an MJPEG stream directly.

## Build

```bash
go build
```

## Run

```bash
PROXY_PORT=8000 \
BACKEND_URL=http://localhost:8080 \
FRONTEND_URL=http://localhost:3000 \
CAPTURE_DAEMON_URL=http://localhost:9000 \
./camera-proxy
```

## Test

```bash
go test
```

## Notes

The proxy negotiates WebRTC with the capture-daemon's `/webrtc/offer` endpoint. When
negotiation is unavailable or fails, clients receive an MJPEG stream instead.
