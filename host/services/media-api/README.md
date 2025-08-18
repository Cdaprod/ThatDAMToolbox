# media-api

Minimal Go rewrite of the Python video API. Provides `/api/v2/health` plus simple asset endpoints.

## Usage

```bash
# build and run
cd host/services/media-api
go run ./cmd/media-api serve --addr :8080
```

### Endpoints

```bash
curl -s http://localhost:8080/v1/folders
```

## Tests

```bash
go test ./...
```

