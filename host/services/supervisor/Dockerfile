# syntax=docker/dockerfile:1.5

ARG GO_VERSION=1.23
FROM golang:${GO_VERSION}-alpine AS builder
ARG TARGETOS TARGETARCH VERSION
ENV CGO_ENABLED=0 GOTOOLCHAIN=auto
WORKDIR /src

# manifests
COPY host/services/shared/go.mod          host/services/shared/go.mod
COPY host/services/shared/go.sum          host/services/shared/go.sum
COPY host/services/shared/hostcap/v4l2probe/go.mod host/services/shared/hostcap/v4l2probe/go.mod
COPY host/services/supervisor/go.mod      host/services/supervisor/go.mod
COPY host/services/supervisor/go.sum      host/services/supervisor/go.sum
COPY host/shared/go.mod                   host/shared/go.mod

# workspace
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    sh -ceu '\
      go work init ./host/services/supervisor; \
      go work use  ./host/services/shared; \
      go work sync \
    '

# sources
COPY host/services/shared/            host/services/shared/
COPY host/services/supervisor/        host/services/supervisor/
COPY host/shared/                     host/shared/

# build (cmd/supervisor is the main package)
WORKDIR /src/host/services/supervisor
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -v -o /out/supervisor ./cmd/supervisor

# runtime
FROM alpine:3.20
ARG VCS_REF
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.vendor="Cdaprod" \
      org.opencontainers.image.title="ThatDAMToolbox - supervisor" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$IMAGE_TAG
RUN apk add --no-cache ca-certificates
COPY --from=builder /out/supervisor /usr/local/bin/supervisor
EXPOSE 8070
ENTRYPOINT ["/usr/local/bin/supervisor"]
