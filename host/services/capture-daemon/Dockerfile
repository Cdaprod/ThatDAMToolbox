# ---------- Build Stage ----------
FROM golang:1.22-alpine AS builder

# 1. Set up build workspace
WORKDIR /build

# 2. Copy ONLY go.mod/go.sum first (for cacheable layer)
COPY host/services/capture-daemon/go.mod ./capture-daemon/
COPY host/services/shared/go.mod ./shared/

# 3. Pre-build deps using vendor (assumes you have run `go mod vendor` already)
#COPY host/services/capture-daemon/vendor ./capture-daemon/vendor

# 4. Copy the rest of the sources (including shared)
COPY host/services/capture-daemon/ ./capture-daemon/
COPY host/services/shared/ ./shared/

# 5. Build capture-daemon using vendor, output statically linked binary
WORKDIR /build/capture-daemon
RUN go build -mod=vendor -o /out/capture-daemon ./main.go

# ---------- Runtime Stage ----------
FROM alpine:3.20 AS runtime

RUN apk add --no-cache ffmpeg tini curl

COPY --from=builder /out/capture-daemon /usr/local/bin/capture-daemon

ENTRYPOINT ["/sbin/tini", "-s", "--", "/usr/local/bin/capture-daemon"]