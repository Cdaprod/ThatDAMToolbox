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
COPY host/services/overlay-hub/go.mod     host/services/overlay-hub/go.mod
COPY host/services/overlay-hub/go.sum     host/services/overlay-hub/go.sum

# ── minimal workspace (service + shared)
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    sh -ceu '\
      go work init ./host/services/overlay-hub; \
      go work use  ./host/services/shared; \
      go work sync \
    '

# ── sources
COPY host/services/shared/            host/services/shared/
COPY host/services/overlay-hub/       host/services/overlay-hub/

# ── build (expects ./cmd)
WORKDIR /src/host/services/overlay-hub
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -v -o /out/overlay-hub ./cmd

# ── runtime
FROM alpine:3.20
ARG VERSION
LABEL org.opencontainers.image.version=$VERSION
RUN apk add --no-cache ca-certificates
COPY --from=builder /out/overlay-hub /usr/local/bin/overlay-hub
EXPOSE 9090
ENTRYPOINT ["/usr/local/bin/overlay-hub"]