# simple Go build
ARG GO_VERSION=1.23
FROM golang:${GO_VERSION}-alpine AS build
ENV CGO_ENABLED=0 GOTOOLCHAIN=auto

WORKDIR /src
COPY . .
RUN go build -o overlay-hub ./cmd/overlay-hub

FROM alpine:3.20

WORKDIR /app
COPY --from=build /src/overlay-hub /app/overlay-hub
EXPOSE 8090
ENTRYPOINT ["/app/overlay-hub"]
