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

### Logging

Configure via environment variables:

- `LOG_LEVEL` – debug|info|warn|error (default info)
- `LOG_FORMAT` – auto|json|text (default auto)
- `LOG_CALLER` – off|short|full (default short)
- `LOG_TIME` – off|rfc3339|rfc3339ms (default rfc3339ms)
- `LOG_NO_COLOR` – set to `1` to disable colored output
- `SRT_BASE_URL` – base SRT address advertised at `/api/registry/srt`
- `AUTH_PRIVATE_KEY_PEM` – base64-encoded RSA private key for token signing; if unset, a temporary key is generated

## Overlay endpoints
- `POST /agents/issue`
- `GET /.well-known/jwks.json`
- `POST /auth/session/exchange`
- `GET /overlay/hints`


### See also
- [camera-proxy](../camera-proxy/README.md)
- [capture-daemon](../capture-daemon/README.md)
- [overlay-hub](../overlay-hub/README.md)
- [Hardware Capture Module](../../../video/modules/hwcapture/README.md)
- [Wireless HDMI Transmitter Architecture](../../../docs/TECHNICAL/wireless-hdmi/transmitter-architecture.md)

## Stream endpoints (JWT required)
- `POST /streams` – register transmitter metadata
- `GET /streams` – list active streams
- `GET /streams/{id}` – retrieve stream
- `PUT /streams/{id}` – update codecs/transports
- `DELETE /streams/{id}` – remove stream
- `POST /streams/{id}/offer` – submit WebRTC offer
- `GET /streams/{id}/offer` – fetch offer
- `POST /streams/{id}/answer` – submit answer
- `GET /streams/{id}/answer` – fetch answer
- `POST /streams/{id}/ice` – append ICE candidate
- `GET /streams/{id}/ice` – list ICE candidates

All endpoints (except JWKS and token issuance) expect an `Authorization: Bearer <token>` header.

## RTP session registry

- `POST /rtp/sessions` – register an RTP session
- `GET /rtp/sessions/{id}.sdp` – fetch SDP descriptor

```bash
curl -X POST localhost:8080/rtp/sessions \
  -d '{"id":"cam1","address":"239.0.0.1","port":5004,"payload_type":96,"clock_rate":90000}'
```

