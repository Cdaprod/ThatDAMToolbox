# syntax=docker/dockerfile:1.5

ARG GO_VERSION=1.23
FROM golang:${GO_VERSION}-alpine AS builder
ARG TARGETOS TARGETARCH VERSION
ENV CGO_ENABLED=0 GOTOOLCHAIN=auto
WORKDIR /src

# ── manifests first
COPY host/services/shared/go.mod          host/services/shared/go.mod
COPY host/services/shared/go.sum          host/services/shared/go.sum
COPY host/services/camera-proxy/go.mod    host/services/camera-proxy/go.mod
COPY host/services/camera-proxy/go.sum    host/services/camera-proxy/go.sum

# ── minimal workspace (service + shared)
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    sh -ceu '\
      go work init ./host/services/camera-proxy; \
      go work use  ./host/services/shared; \
      go work sync \
    '

# ── sources
COPY host/services/shared/            host/services/shared/
COPY host/services/camera-proxy/      host/services/camera-proxy/

# ── build (main at repo root of module)
WORKDIR /src/host/services/camera-proxy
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -v -o /out/camera-proxy .

# ── runtime (needs ffmpeg, v4l2 utils for device probing)
FROM alpine:3.20
ARG VERSION
LABEL org.opencontainers.image.version=$VERSION
RUN apk add --no-cache ca-certificates ffmpeg v4l-utils usbutils
COPY --from=builder /out/camera-proxy /usr/local/bin/camera-proxy
EXPOSE 8000
ENV LOG_FORMAT=json LOG_TIME=rfc3339ms LOG_CALLER=short
ENTRYPOINT ["/usr/local/bin/camera-proxy"]