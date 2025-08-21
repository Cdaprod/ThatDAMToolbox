# overlay-hub

A minimal hub relaying overlay agent traffic.

## Usage

```
go run ./cmd/overlay-hub/main.go -addr :8090
```


## API

### `GET /healthz`
Health check returning `ok` when the service is up.

- **Request:** none
- **Response:** `200 OK` with plain text `ok`

```bash
curl -i http://localhost:8090/healthz
```

### `GET /metrics`
Prometheus metrics endpoint.

- **Request:** none
- **Response:** `200 OK` with Prometheus-formatted metrics

```bash
curl -i http://localhost:8090/metrics
```

### `POST /v1/register`
Register an overlay agent.

- **Request:** bearer token in `Authorization` header, empty body
- **Response:** `200 OK` with no body

```bash
curl -i -X POST http://localhost:8090/v1/register \
  -H "Authorization: Bearer $TOKEN"
```

### `POST /v1/heartbeat`
Send a heartbeat to keep the registration alive.

- **Request:** bearer token in `Authorization` header, empty body
- **Response:** `200 OK` with no body

```bash
curl -i -X POST http://localhost:8090/v1/heartbeat \
  -H "Authorization: Bearer $TOKEN"
```

### `POST /v1/negotiate`
Reserved for future connection negotiation.

- **Request:** bearer token in `Authorization` header, empty body
- **Response:** `200 OK` with no body

```bash
curl -i -X POST http://localhost:8090/v1/negotiate \
  -H "Authorization: Bearer $TOKEN"
```

## Testing

```bash
go test ./...
```

Endpoints:
- `GET /healthz`
- `GET /metrics`
- `POST /v1/register`
- `POST /v1/heartbeat`
- `POST /v1/negotiate` – returns `{transport,endpoints,abr_ceiling}`

## Tests

```
go test ./...
```

- `POST /v1/negotiate`

- `POST /v1/publish`
- `POST /v1/subscribe`
- `POST /v1/reroute`
- `POST /v1/telemetry`
- `POST /v1/node/init`


### See also
- [camera-proxy](../camera-proxy/README.md)
- [capture-daemon](../capture-daemon/README.md)
- [api-gateway](../api-gateway/README.md)
- [Hardware Capture Module](../../../video/modules/hwcapture/README.md)
- [Wireless HDMI Transmitter Architecture](../../../docs/TECHNICAL/wireless-hdmi/transmitter-architecture.md)



