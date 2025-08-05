# ─── Stage 1: Build the capture-daemon binary ───────────────────────────────
FROM golang:1.24-alpine AS builder

# Install git (needed for VCS-based modules) and ca-certs
RUN apk add --no-cache git ca-certificates

WORKDIR /build

# 1) Copy only go.mod (we don’t keep go.sum)
COPY host/services/capture-daemon/go.mod ./capture-daemon/go.mod
COPY host/services/shared/go.mod    ./shared/go.mod

# 2) Copy all source
COPY host/services/capture-daemon/ ./capture-daemon/
COPY host/services/shared/        ./shared/

# 3) Generate go.sum, download modules & vendor them
WORKDIR /build/capture-daemon
RUN go mod tidy \
 && go mod vendor

# 4) Compile using vendored deps
RUN go build -mod=vendor -o /out/capture-daemon ./main.go

# ─── Stage 2: Runtime image ─────────────────────────────────────────────────
FROM alpine:3.20

# runtime deps
RUN apk add --no-cache ffmpeg tini curl ca-certificates

# default feature flags
ENV ENABLE_HLS_PREVIEW=true
ENV HLS_PREVIEW_DIR=/tmp/hls
ENV ENABLE_MP4_SERVE=false
ENV MP4_RECORDINGS_DIR=/tmp/recordings

# copy the binary
COPY --from=builder /out/capture-daemon /usr/local/bin/capture-daemon

ENTRYPOINT ["/sbin/tini", "-s", "--", "/usr/local/bin/capture-daemon"]