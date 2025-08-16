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

# build
WORKDIR /src/host/services/supervisor
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -v -o /out/supervisor ./cmd

# runtime
FROM alpine:3.20
ARG VERSION
LABEL org.opencontainers.image.version=$VERSION
RUN apk add --no-cache ca-certificates
COPY --from=builder /out/supervisor /usr/local/bin/supervisor
EXPOSE 8070
ENTRYPOINT ["/usr/local/bin/supervisor"]
