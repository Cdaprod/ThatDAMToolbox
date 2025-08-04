# ─── Stage 1: Build the capture-daemon binary ─────────────────────────────────
FROM golang:1.22-alpine AS builder

# Install git (for module checkouts) and ca-certs (for HTTPS)
RUN apk add --no-cache git ca-certificates

WORKDIR /build

# 1) Copy go.mod + go.sum to prime the cache
COPY host/services/capture-daemon/go.mod host/services/capture-daemon/go.sum ./capture-daemon/
COPY host/services/shared/go.mod    host/services/shared/go.sum    ./shared/

# 2) Copy all source
COPY host/services/capture-daemon/ ./capture-daemon/
COPY host/services/shared/        ./shared/

# 3) Vendor dependencies
WORKDIR /build/capture-daemon
RUN go mod download \
 && go mod vendor

# 4) Compile, using the vendored deps
RUN go build -mod=vendor -o /out/capture-daemon ./main.go

# ─── Stage 2: Runtime image ───────────────────────────────────────────────────
FROM alpine:3.20

# runtime dependencies
RUN apk add --no-cache ffmpeg tini curl ca-certificates

# copy the built binary
COPY --from=builder /out/capture-daemon /usr/local/bin/capture-daemon

ENTRYPOINT ["/sbin/tini", "-s", "--", "/usr/local/bin/capture-daemon"]