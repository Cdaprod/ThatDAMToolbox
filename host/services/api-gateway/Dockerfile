# syntax=docker/dockerfile:1

FROM golang:1.22-alpine AS build
ARG TARGETOS TARGETARCH VERSION
WORKDIR /src
COPY go.work ./
COPY host/services/shared/go.mod host/services/shared/go.mod
COPY host/services/shared/go.sum host/services/shared/go.sum
COPY host/services/api-gateway/go.mod host/services/api-gateway/go.mod
COPY host/services/api-gateway/go.sum host/services/api-gateway/go.sum
RUN go work sync
COPY host/services/shared/ host/services/shared/
COPY host/services/api-gateway/ host/services/api-gateway/
WORKDIR /src/host/services/api-gateway
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/api-gateway ./cmd

FROM alpine:3.20
ARG VERSION
LABEL org.opencontainers.image.version=$VERSION
RUN apk add --no-cache ca-certificates
COPY --from=build /out/api-gateway /usr/local/bin/api-gateway
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/api-gateway"]

