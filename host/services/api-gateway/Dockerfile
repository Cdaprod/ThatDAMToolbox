# syntax=docker/dockerfile:1.5

ARG GO_VERSION=1.23
FROM golang:${GO_VERSION}-alpine AS builder
ARG TARGETOS TARGETARCH VERSION
ENV CGO_ENABLED=0 GOTOOLCHAIN=auto
WORKDIR /src

# ── copy ONLY the module manifests first (cache-friendly)
COPY host/services/shared/go.mod        host/services/shared/go.mod
COPY host/services/shared/go.sum        host/services/shared/go.sum
COPY host/services/shared/hostcap/v4l2probe/go.mod host/services/shared/hostcap/v4l2probe/go.mod
COPY host/services/api-gateway/go.mod   host/services/api-gateway/go.mod
COPY host/services/api-gateway/go.sum   host/services/api-gateway/go.sum
COPY host/shared/go.mod                 host/shared/go.mod

# ── create a minimal workspace (avoid copying repo go.work that includes other modules)
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    sh -ceu '\
      go work init ./host/services/api-gateway; \
      go work use  ./host/services/shared; \
      go work sync \
    '

# ── now bring in sources
COPY host/services/shared/        host/services/shared/
COPY host/services/api-gateway/   host/services/api-gateway/
COPY host/shared/                 host/shared/

WORKDIR /src/host/services/api-gateway
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -v -o /out/api-gateway ./cmd

# ── runtime
FROM alpine:3.20
ARG VCS_REF
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.vendor="Cdaprod" \
      org.opencontainers.image.title="ThatDAMToolbox - api-gateway" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$IMAGE_TAG
RUN apk add --no-cache ca-certificates
COPY --from=builder /out/api-gateway /usr/local/bin/api-gateway
EXPOSE 8080
ENV LOG_FORMAT=json LOG_TIME=rfc3339ms LOG_CALLER=short
ENTRYPOINT ["/usr/local/bin/api-gateway"]