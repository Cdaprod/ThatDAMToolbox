# syntax=docker/dockerfile:1.5

# ─── Stage 1: Build the capture-daemon binary ───────────────────────────────
ARG GO_VERSION=1.23
FROM golang:${GO_VERSION}-alpine AS builder
ARG TARGETOS TARGETARCH VERSION
ENV CGO_ENABLED=0 GOTOOLCHAIN=auto
WORKDIR /src

# 1) Copy only manifests (cache-friendly)
COPY host/services/shared/go.mod            host/services/shared/go.mod
COPY host/services/shared/go.sum            host/services/shared/go.sum
COPY host/services/capture-daemon/go.mod    host/services/capture-daemon/go.mod
COPY host/services/capture-daemon/go.sum    host/services/capture-daemon/go.sum

# 2) Create a minimal workspace (ONLY what we’ll copy: capture-daemon + shared)
#    Avoid copying repo-root go.work which references missing modules.
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    sh -ceu '\
      go work init ./host/services/capture-daemon; \
      go work use  ./host/services/shared; \
      go work sync \
    '

# 3) Copy sources
COPY host/services/shared/               host/services/shared/
COPY host/services/capture-daemon/       host/services/capture-daemon/

# 4) Build (module root has main.go)
WORKDIR /src/host/services/capture-daemon
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -v -o /out/capture-daemon .

# ─── Stage 2: Runtime image ─────────────────────────────────────────────────
FROM alpine:3.20
ARG VERSION
LABEL org.opencontainers.image.version=$VERSION

# runtime deps
RUN apk add --no-cache ffmpeg tini curl ca-certificates

# ── CONFIGURATION DEFAULTS ───────────────────────────────────────────────────
# Broker
ENV CAPTURE_BROKER_URL="amqp://video:video@rabbitmq:5672/" \
    CAPTURE_BROKER_EXCHANGE="capture" \
    CAPTURE_BROKER_CONNECT_TIMEOUT="10s" \
    CAPTURE_BROKER_RECONNECT_DELAY="5s" \
    CAPTURE_BROKER_MAX_RETRIES="5" \
# Capture
    CAPTURE_CAPTURE_OUTPUT_DIR="/tmp/recordings" \
    CAPTURE_CAPTURE_POLL_INTERVAL="5s" \
    CAPTURE_CAPTURE_FFMPEG_PATH="ffmpeg" \
    CAPTURE_CAPTURE_DEFAULT_FPS="30" \
    CAPTURE_CAPTURE_DEFAULT_RESOLUTION="1920x1080" \
    CAPTURE_CAPTURE_MAX_CONCURRENT="10" \
# Features: HLS preview
    CAPTURE_FEATURES_HLS_PREVIEW_ENABLED="true" \
    CAPTURE_FEATURES_HLS_PREVIEW_DIR="/tmp/hls" \
    CAPTURE_FEATURES_HLS_PREVIEW_TTL="1h" \
# Features: MP4 serving
    CAPTURE_FEATURES_MP4_SERVE_ENABLED="false" \
    CAPTURE_FEATURES_MP4_SERVE_DIR="/tmp/recordings" \
# Features: Metrics
    CAPTURE_FEATURES_METRICS_ENABLED="true" \
    CAPTURE_FEATURES_METRICS_PORT="9001" \
    CAPTURE_FEATURES_METRICS_PATH="/metrics" \
# Logging
    CAPTURE_LOGGING_LEVEL="info" \
    CAPTURE_LOGGING_FORMAT="json" \
    CAPTURE_LOGGING_OUTPUT="stdout" \
# Health checks
    CAPTURE_HEALTH_ENABLED="true" \
    CAPTURE_HEALTH_PORT="9002" \
    CAPTURE_HEALTH_INTERVAL="30s"

# copy the binary
COPY --from=builder /out/capture-daemon /usr/local/bin/capture-daemon

EXPOSE 9000
ENTRYPOINT ["/sbin/tini","-s","--","/usr/local/bin/capture-daemon"]