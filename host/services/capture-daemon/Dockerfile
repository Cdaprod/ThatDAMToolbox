# ─── Stage 1: Build the capture-daemon binary ───────────────────────────────
FROM golang:1.24-alpine AS builder

# Install git (needed for VCS-based modules) and ca-certs
RUN apk add --no-cache git ca-certificates

WORKDIR /build

# 1) Copy only go.mod (we don’t keep go.sum)
COPY host/services/capture-daemon/go.mod ./capture-daemon/go.mod
COPY host/services/shared/go.mod         ./shared/go.mod

# 2) Copy all source
COPY host/services/capture-daemon/       ./capture-daemon/
COPY host/services/shared/               ./shared/

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
# ── CONFIGURATION DEFAULTS ───────────────────────────────────────────────────
# Broker
ENV CAPTURE_BROKER_URL="amqp://video:video@rabbitmq:5672/"
ENV CAPTURE_BROKER_EXCHANGE="capture"
ENV CAPTURE_BROKER_CONNECT_TIMEOUT="10s"
ENV CAPTURE_BROKER_RECONNECT_DELAY="5s"
ENV CAPTURE_BROKER_MAX_RETRIES="5"

# Capture
ENV CAPTURE_CAPTURE_OUTPUT_DIR="/tmp/recordings"
ENV CAPTURE_CAPTURE_POLL_INTERVAL="5s"
ENV CAPTURE_CAPTURE_FFMPEG_PATH="ffmpeg"
ENV CAPTURE_CAPTURE_DEFAULT_FPS="30"
ENV CAPTURE_CAPTURE_DEFAULT_RESOLUTION="1920x1080"
ENV CAPTURE_CAPTURE_MAX_CONCURRENT="10"

# Features: HLS preview
ENV CAPTURE_FEATURES_HLS_PREVIEW_ENABLED="true"
ENV CAPTURE_FEATURES_HLS_PREVIEW_DIR="/tmp/hls"
ENV CAPTURE_FEATURES_HLS_PREVIEW_TTL="1h"

# Features: MP4 serving
ENV CAPTURE_FEATURES_MP4_SERVE_ENABLED="false"
ENV CAPTURE_FEATURES_MP4_SERVE_DIR="/tmp/recordings"

# Features: Metrics
ENV CAPTURE_FEATURES_METRICS_ENABLED="true"
ENV CAPTURE_FEATURES_METRICS_PORT="9001"
ENV CAPTURE_FEATURES_METRICS_PATH="/metrics"

# Logging
ENV CAPTURE_LOGGING_LEVEL="info"
ENV CAPTURE_LOGGING_FORMAT="json"
ENV CAPTURE_LOGGING_OUTPUT="stdout"

# Health checks
ENV CAPTURE_HEALTH_ENABLED="true"
ENV CAPTURE_HEALTH_PORT="9002"
ENV CAPTURE_HEALTH_INTERVAL="30s"

# copy the binary
COPY --from=builder /out/capture-daemon /usr/local/bin/capture-daemon

ENTRYPOINT ["/sbin/tini", "-s", "--", "/usr/local/bin/capture-daemon"]