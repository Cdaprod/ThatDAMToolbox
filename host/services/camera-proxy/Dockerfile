# syntax=docker/dockerfile:1.5

ARG GO_VERSION=1.23
FROM golang:${GO_VERSION}-alpine AS builder
ARG TARGETOS TARGETARCH VERSION
ENV CGO_ENABLED=0 GOTOOLCHAIN=auto
WORKDIR /src

# ── manifests first
COPY host/services/shared/go.mod          host/services/shared/go.mod
COPY host/services/shared/go.sum          host/services/shared/go.sum
COPY host/services/shared/hostcap/v4l2probe/go.mod host/services/shared/hostcap/v4l2probe/go.mod
COPY host/services/camera-proxy/go.mod    host/services/camera-proxy/go.mod
COPY host/services/camera-proxy/go.sum    host/services/camera-proxy/go.sum
COPY host/shared/go.mod                   host/shared/go.mod

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
COPY host/shared/                     host/shared/

# ── build (main at repo root of module)
WORKDIR /src/host/services/camera-proxy
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -v -o /out/camera-proxy .

# ── viewer builder (player + proxy-viewer)
FROM node:20-alpine AS viewer-builder
WORKDIR /app

# copy packages used by proxy-viewer
COPY docker/packages/player/ ./packages/player/
COPY docker/packages/design-system/ ./packages/design-system/
COPY docker/packages/stream-registry/ ./packages/stream-registry/
COPY docker/proxy-viewer/ ./proxy-viewer/

# install and build local packages then bundle the viewer
RUN --mount=type=cache,target=/root/.npm \
    npm --prefix packages/player install && npm --prefix packages/player run build && \
    npm --prefix packages/design-system install && npm --prefix packages/design-system run build && \
    npm --prefix packages/stream-registry install && \
    npm --prefix proxy-viewer install && npm --prefix proxy-viewer run build

# ── runtime (needs ffmpeg, v4l2 utils for device probing)
FROM alpine:3.20
ARG VCS_REF
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.vendor="Cdaprod" \
      org.opencontainers.image.title="ThatDAMToolbox - camera-proxy" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$IMAGE_TAG
# Install runtime dependencies
RUN apk add --no-cache bash ca-certificates ffmpeg v4l-utils usbutils
COPY host/services/camera-proxy/entrypoint.sh /entrypoint.sh
COPY host/services/shared/entrypoint-snippet.sh /opt/shared/entrypoint-snippet.sh
RUN chmod +x /entrypoint.sh /opt/shared/entrypoint-snippet.sh
COPY --from=builder /out/camera-proxy /usr/local/bin/camera-proxy
# Static viewer bundle
COPY --from=viewer-builder /app/proxy-viewer/dist /srv/viewer
EXPOSE 8000
ENV LOG_FORMAT=json LOG_TIME=rfc3339ms LOG_CALLER=short
ENV VIEWER_DIR=/srv/viewer
ENTRYPOINT ["/entrypoint.sh"]
