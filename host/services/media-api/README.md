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

### Preview worker

To generate placeholder previews for ingested assets, the API can run a small
worker that listens for `asset.ingested` events and writes a `poster.jpg` under
`derived/poster.jpg/..`.

```
export BROKER_URL=inproc
go test ./pkg/handlers -run PreviewWorker -v
```

## Tests

```bash
go test ./...
```

