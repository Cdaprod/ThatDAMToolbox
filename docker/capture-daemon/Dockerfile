# ---------- build stage ----------
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod \
    CGO_ENABLED=0 go build -o capture-daemon ./main.go

# ---------- runtime stage ----------
FROM alpine:latest AS runtime
# tini keeps signal handling clean
RUN apk add --no-cache ffmpeg tini
COPY --from=build /src/capture-daemon /usr/local/bin/capture-daemon
ENTRYPOINT ["/sbin/tini","--","capture-daemon"]