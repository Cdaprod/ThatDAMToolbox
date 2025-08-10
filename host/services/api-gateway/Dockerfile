# syntax=docker/dockerfile:1

ARG GO_VERSION=1.23
FROM golang:${GO_VERSION}-alpine AS builder
ENV CGO_ENABLED=0 GOTOOLCHAIN=auto
ARG TARGETOS TARGETARCH VERSION
WORKDIR /src

# bring in workspace and manifests first for caching
COPY go.work go.work.sum ./
COPY host/services/shared/go.mod host/services/shared/go.mod
COPY host/services/shared/go.sum host/services/shared/go.sum
COPY host/services/api-gateway/go.mod host/services/api-gateway/go.mod
COPY host/services/api-gateway/go.sum host/services/api-gateway/go.sum

# sync workspace to resolve local modules
RUN go work sync

# now copy sources
COPY host/services/shared/ host/services/shared/
COPY host/services/api-gateway/ host/services/api-gateway/

WORKDIR /src/host/services/api-gateway
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    GOOS=$TARGETOS GOARCH=$TARGETARCH go build -v -o /out/api-gateway ./cmd

FROM alpine:3.20
ARG VERSION
LABEL org.opencontainers.image.version=$VERSION
RUN apk add --no-cache ca-certificates
COPY --from=builder /out/api-gateway /usr/local/bin/api-gateway
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/api-gateway"]

