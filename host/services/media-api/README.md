# media-api

Minimal Go rewrite of the Python video API. Provides `/api/v2/health` and a
Cobra-based CLI.

## Usage

```bash
# build and run
cd host/services/media-api
go run ./cmd/media-api serve --addr :8080
```

## Tests

```bash
go test ./...
```

