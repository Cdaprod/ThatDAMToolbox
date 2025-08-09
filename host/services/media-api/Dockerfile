# /host/services/media-api/Dockerfile
# Build media-api service
FROM golang:1.22 AS build
WORKDIR /app
COPY . .
RUN go build -o media-api ./cmd/media-api

FROM gcr.io/distroless/base-debian12
COPY --from=build /app/media-api /media-api
ENTRYPOINT ["/media-api", "serve", "--addr", ":8080"]

