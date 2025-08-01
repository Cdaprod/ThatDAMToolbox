# ---------- Builder Stage ----------
FROM golang:1.22-alpine AS builder

WORKDIR /build

# Copy only module files for caching
COPY host/services/capture-daemon/go.mod ./capture-daemon/go.mod
COPY host/services/shared/go.mod ./shared/go.mod

# Download deps and vendor them (one layer, ensures idempotence)
WORKDIR /build/capture-daemon
RUN go mod tidy && go mod vendor

# Copy source after vendoring (avoids cache bust unless code changes)
COPY host/services/capture-daemon/ ./capture-daemon/
COPY host/services/shared/ ./shared/

# Build statically (never needs network now, uses vendor)
WORKDIR /build/capture-daemon
RUN go build -mod=vendor -o /out/capture-daemon ./main.go

# ---------- Runtime Stage ----------
FROM alpine:3.20
RUN apk add --no-cache ffmpeg tini curl
COPY --from=builder /out/capture-daemon /usr/local/bin/capture-daemon
ENTRYPOINT ["/sbin/tini", "-s", "--", "/usr/local/bin/capture-daemon"]