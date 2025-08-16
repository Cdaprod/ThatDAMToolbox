# ─────────────────────────────────────────────────────────────────────────────
# Minimal runtime; no docker-in-docker, no extra daemons
# Uses your Go code’s in-process mDNS (pion/mdns) and Serf libraries.
# NOTE: Replace any curly/en-dashes from earlier drafts with regular ASCII.
# ─────────────────────────────────────────────────────────────────────────────
FROM golang:1.23-alpine AS build
WORKDIR /src

# manifests
COPY host/services/shared/go.mod          host/services/shared/go.mod
COPY host/services/shared/go.sum          host/services/shared/go.sum
COPY host/services/shared/hostcap/v4l2probe/go.mod host/services/shared/hostcap/v4l2probe/go.mod
COPY host/services/discovery/go.mod       host/services/discovery/go.mod
COPY host/services/discovery/go.sum       host/services/discovery/go.sum

# workspace
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    sh -ceu '\
      go work init ./host/services/discovery; \
      go work use  ./host/services/shared; \
      go work sync \
    '

# sources
COPY host/services/shared/               host/services/shared/
COPY host/services/discovery/            host/services/discovery/

# build
WORKDIR /src/host/services/discovery
RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 go build -o /out/discovery-service ./...

FROM alpine:3.20
# runtime deps: curl for healthcheck; tzdata/ca-certs for logs/https if you add remote calls
RUN apk add --no-cache ca-certificates tzdata curl
WORKDIR /app
COPY --from=build /out/discovery-service /usr/local/bin/discovery-service

# no root-required daemons (avahi/serf binaries) needed because your code uses libs
# if you later add external daemons, you can re-introduce packages and run as root.

ENV DISCOVERY_BACKEND=auto \
    SERVICE_NAME=thatdam \
    SERVICE_PORT=8080 \
    DISCOVERY_HTTP_PORT=9999 \
    LEADER_FILE=/run/discovery/leader.env \
    LOG_FORMAT=json LOG_TIME=rfc3339ms LOG_CALLER=short
VOLUME ["/run/discovery"]

EXPOSE 9999
ENTRYPOINT ["/usr/local/bin/discovery-service"]
