# --- Build stage ---
FROM golang:1.22-alpine AS builder
WORKDIR /src/host/services/capture-daemon

# Bring in go.mod + go.sum *first* for cache
COPY host/services/capture-daemon/go.mod .

# Download only this module’s deps
RUN go mod download

# Now bring in all the source for build/lint/test
COPY host/services/capture-daemon/ .

# (Optional) bring in shared if you import it as a local module
COPY host/services/shared/ ../../shared/

# Run vet, lint, test, build as needed
RUN go vet ./...
RUN go build -o /out/capture-daemon ./main.go

# --- Runtime stage ---
FROM alpine:3.20
RUN apk add --no-cache ffmpeg tini curl
COPY --from=builder /out/capture-daemon /usr/local/bin/capture-daemon
ENTRYPOINT ["/sbin/tini", "-s", "--", "/usr/local/bin/capture-daemon"]