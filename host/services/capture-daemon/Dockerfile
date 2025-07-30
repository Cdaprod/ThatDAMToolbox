# /host/services/capture-daemon/Dockerfile
# ---------- build stage ----------
FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod ./
COPY . .
RUN CGO_ENABLED=0 go build -o capture-daemon ./main.go

# ---------- runtime stage ----------
FROM alpine:3.20 AS runtime
RUN apk add --no-cache ffmpeg tini curl
COPY --from=build /src/capture-daemon /usr/local/bin/capture-daemon
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/capture-daemon"]