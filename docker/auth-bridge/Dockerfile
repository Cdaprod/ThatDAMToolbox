# syntax=docker/dockerfile:1.5
ARG GO_VERSION=1.23
FROM golang:${GO_VERSION}-alpine AS builder
WORKDIR /src

# Copy minimal manifests for faster incremental builds
COPY host/services/auth-bridge/go.mod host/services/auth-bridge/go.mod
COPY host/services/auth-bridge/go.sum host/services/auth-bridge/go.sum
RUN --mount=type=cache,target=/go/pkg/mod go mod download

# Copy sources
COPY host/services/auth-bridge/ host/services/auth-bridge/
WORKDIR /src/host/services/auth-bridge
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -o /out/auth-bridge ./cmd/auth-bridge

FROM alpine:3.20
ARG VCS_REF
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.vendor="Cdaprod" \
      org.opencontainers.image.title="ThatDAMToolbox - auth-bridge" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$IMAGE_TAG
RUN apk add --no-cache ca-certificates
COPY --from=builder /out/auth-bridge /usr/local/bin/auth-bridge
EXPOSE 8081
ENTRYPOINT ["/usr/local/bin/auth-bridge"]

