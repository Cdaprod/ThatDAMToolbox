# Tenancy Service

In-memory tenant and membership management API.

## Usage

```bash
go run ./cmd/tenancy/main.go
# in another terminal
curl -X POST http://localhost:8082/login -H "X-User-ID: user1"
```

## Tests

```bash
go test ./...
```

