# syntax=docker/dockerfile:1

FROM golang:1.24-alpine AS build
ARG TARGETOS TARGETARCH VERSION
WORKDIR /src

COPY host/services/camera-proxy/go.mod ./go.mod
COPY host/services/camera-proxy/go.sum ./go.sum
COPY host/services/shared/go.mod ./shared/go.mod
RUN go mod tidy

COPY host/services/camera-proxy/ ./camera-proxy/
COPY host/services/shared/ ./shared/

WORKDIR /src/camera-proxy
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/camera-proxy .

FROM alpine:3.20
ARG VERSION
LABEL org.opencontainers.image.version=$VERSION
RUN apk add --no-cache ca-certificates ffmpeg
COPY --from=build /out/camera-proxy /usr/local/bin/camera-proxy
EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/camera-proxy"]

