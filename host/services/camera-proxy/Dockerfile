# syntax=docker/dockerfile:1

FROM golang:1.22-alpine AS build
ARG TARGETOS TARGETARCH VERSION
WORKDIR /src
COPY go.work ./
COPY host/services/shared/go.mod host/services/shared/go.mod
COPY host/services/shared/go.sum host/services/shared/go.sum
COPY host/services/camera-proxy/go.mod host/services/camera-proxy/go.mod
COPY host/services/camera-proxy/go.sum host/services/camera-proxy/go.sum
RUN go work sync
COPY host/services/shared/ host/services/shared/
COPY host/services/camera-proxy/ host/services/camera-proxy/
WORKDIR /src/host/services/camera-proxy
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/camera-proxy .

FROM alpine:3.20
ARG VERSION
LABEL org.opencontainers.image.version=$VERSION
RUN apk add --no-cache ca-certificates ffmpeg v4l-utils usbutils
COPY --from=build /out/camera-proxy /usr/local/bin/camera-proxy
EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/camera-proxy"]

