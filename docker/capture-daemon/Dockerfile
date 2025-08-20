# /docker/capture-daemon/Dockerfile
# ---------- build stage ----------
ARG GO_VERSION=1.23
FROM golang:${GO_VERSION}-alpine AS build
ENV CGO_ENABLED=0 GOTOOLCHAIN=auto
WORKDIR /src
COPY go.mod ./
COPY . .           # <-- make sure the whole daemon source is here
RUN go build -o capture-daemon ./main.go

# ---------- runtime stage ----------
FROM alpine:3.20 AS runtime
ARG VCS_REF
ARG IMAGE_TAG=dev
LABEL org.opencontainers.image.source="https://github.com/Cdaprod/Media-Indexer-Stdlib-Prototype" \
      org.opencontainers.image.vendor="Cdaprod" \
      org.opencontainers.image.title="ThatDAMToolbox - capture-daemon" \
      org.opencontainers.image.licenses="Apache-2.0" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.version=$IMAGE_TAG
RUN apk add --no-cache ffmpeg tini v4l2loopback-dkms
COPY --from=build /src/capture-daemon /usr/local/bin/capture-daemon
ENTRYPOINT ["/sbin/tini","--"]          # final CMD supplied by compose
