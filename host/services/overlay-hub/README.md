# overlay-hub

A minimal hub relaying overlay agent traffic.

## Usage

```
go run ./cmd/overlay-hub/main.go -addr :8090
```

Endpoints:
- `GET /healthz`
- `GET /metrics`
- `POST /v1/register`
- `POST /v1/heartbeat`
- `POST /v1/negotiate`

### See also
- [camera-proxy](../camera-proxy/README.md)
- [capture-daemon](../capture-daemon/README.md)
- [api-gateway](../api-gateway/README.md)
- [Hardware Capture Module](../../../video/modules/hwcapture/README.md)
- [Wireless HDMI Transmitter Architecture](../../../docs/TECHNICAL/wireless-hdmi/transmitter-architecture.md)
