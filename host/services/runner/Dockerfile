# syntax=docker/dockerfile:1.6
ARG GO_VERSION=1.23
FROM golang:${GO_VERSION}-alpine AS builder
WORKDIR /src
ENV CGO_ENABLED=0 GOTOOLCHAIN=auto
COPY host/services/shared/ host/services/shared/
COPY host/services/runner/ host/services/runner/
WORKDIR /src/host/services/runner
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    go build -o /out/runner ./cmd/runner

FROM alpine:3.20
RUN apk add --no-cache ca-certificates bash coreutils findutils
COPY --from=builder /out/runner /usr/local/bin/runner
ENTRYPOINT ["/usr/local/bin/runner"]
