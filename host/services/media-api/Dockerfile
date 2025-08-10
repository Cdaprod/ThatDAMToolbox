# /host/services/media-api/Dockerfile
# Build media-api service
ARG GO_VERSION=1.23
FROM golang:${GO_VERSION} AS build
ENV CGO_ENABLED=0 GOTOOLCHAIN=auto
WORKDIR /app
COPY . .
RUN go build -o media-api ./cmd/media-api

FROM gcr.io/distroless/base-debian12
COPY --from=build /app/media-api /media-api
ENTRYPOINT ["/media-api", "serve", "--addr", ":8080"]

