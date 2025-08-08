# simple Go build
FROM golang:1.20-alpine AS build
WORKDIR /src
COPY . .
RUN go build -o overlay-hub ./cmd/overlay-hub

FROM alpine:3.18
WORKDIR /app
COPY --from=build /src/overlay-hub /app/overlay-hub
EXPOSE 8090
ENTRYPOINT ["/app/overlay-hub"]
