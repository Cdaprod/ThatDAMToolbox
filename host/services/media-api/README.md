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

To generate placeholder previews for ingested assets, run the API with a worker
that listens for `asset.ingested` events and writes a `poster.jpg` under
`derived/poster.jpg/..`.

```
export BLOB_STORE_ROOT=/tmp/blobs
export MEDIA_NETWORK_PATHS=/mnt/media1,/mnt/media2
export PREVIEW_WORKER=1
go run ./cmd/media-api serve --addr :8080 --scan
```

For unit tests:

```
export BROKER_URL=inproc
go test ./pkg/handlers -run PreviewWorker -v
```

### Configuration

- `BLOB_STORE_ROOT` – primary media root (default `./data`)
- `MEDIA_NETWORK_PATHS` – comma-separated additional roots to scan
- `MEDIA_API_CFG` – optional config file with `network_paths=/path1,/path2`

Run the server with `--scan` to index configured roots on startup.

## Tests

```bash
go test ./...
```

