# /host/services/capture-daemon/Dockerfile
# ---------- builder stage ----------
FROM golang:1.22-alpine AS builder
WORKDIR /src

# (1) bring in your workspace file so Go knows about both modules
COPY go.work ./

# (2) copy only the module roots first to prime the cache
COPY host/services/shared/go.mod    host/services/shared/
COPY host/services/capture-daemon/go.mod host/services/capture-daemon/

# (3) grab all deps
RUN go work download

# (4) copy the rest of your code
COPY host/services/shared    host/services/shared
COPY host/services/capture-daemon host/services/capture-daemon

# (5) verify sums & tidy
RUN go work tidy

# (6) build a static binary
RUN CGO_ENABLED=0 \
    go build -mod=readonly \
      -o /capture-daemon \
      host/services/capture-daemon/main.go

# ---------- runtime stage ----------
FROM alpine:3.20 AS runtime
RUN apk add --no-cache ffmpeg tini curl

COPY --from=builder /capture-daemon /usr/local/bin/capture-daemon

ENTRYPOINT ["/sbin/tini", "-s", "--", "/usr/local/bin/capture-daemon"]