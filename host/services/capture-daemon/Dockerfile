FROM golang:1.22-alpine AS builder

WORKDIR /build

# 1. Copy go.mod files to prime the layer cache
COPY host/services/capture-daemon/go.mod ./capture-daemon/go.mod
COPY host/services/shared/go.mod ./shared/go.mod

# 2. Copy *all* source code (including main.go and all subdirs)
COPY host/services/capture-daemon/ ./capture-daemon/
COPY host/services/shared/ ./shared/

# 3. Vendor dependencies AFTER all code is present
WORKDIR /build/capture-daemon
RUN go mod tidy && go mod vendor

# 4. Build the binary using the vendor directory
RUN go build -mod=vendor -o /out/capture-daemon ./main.go

# ---------- Runtime Stage ----------
FROM alpine:3.20
RUN apk add --no-cache ffmpeg tini curl
COPY --from=builder /out/capture-daemon /usr/local/bin/capture-daemon
ENTRYPOINT ["/sbin/tini", "-s", "--", "/usr/local/bin/capture-daemon"]