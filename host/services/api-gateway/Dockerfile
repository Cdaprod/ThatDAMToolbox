# syntax=docker/dockerfile:1

FROM golang:1.24-alpine AS build
ARG TARGETOS TARGETARCH VERSION
WORKDIR /src

COPY host/services/api-gateway/go.mod ./go.mod
COPY host/services/api-gateway/go.sum ./go.sum
COPY host/services/shared/go.mod ./shared/go.mod
RUN go mod tidy

COPY host/services/api-gateway/ ./api-gateway/
COPY host/services/shared/ ./shared/

WORKDIR /src/api-gateway
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH go build -o /out/api-gateway ./cmd

FROM alpine:3.20
ARG VERSION
LABEL org.opencontainers.image.version=$VERSION
RUN apk add --no-cache ca-certificates
COPY --from=build /out/api-gateway /usr/local/bin/api-gateway
EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/api-gateway"]

