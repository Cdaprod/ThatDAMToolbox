# 1) Builder stage
FROM golang:1.20 AS builder
WORKDIR /usr/src/app

# 1a) Copy your workspace file (if you have one) so 'go work' knows about all the modules
COPY go.work .

# 1b) Copy only the module root files first (to populate module cache)
COPY host/services/api-gateway/go.mod       host/services/api-gateway/
COPY host/services/camera-proxy/go.mod      host/services/camera-proxy/
COPY host/services/capture-daemon/go.mod    host/services/capture-daemon/
# If you have a shared module:
COPY host/services/shared/go.mod            host/services/shared/
COPY host/services/shared/hostcap/v4l2probe/go.mod host/services/shared/hostcap/v4l2probe/

# 1c) Copy the rest of your code
COPY host/services/ host/services/

# 2) Download all dependencies (no sums needed on disk)
RUN go work download

# 3) Tidy (will write go.sum files *inside* the container)
RUN go work tidy

# 4) Compile each service, in readonly mode (ensures sum consistency)
RUN mkdir /out
RUN go build -mod=readonly -o /out/api-gateway   ./host/services/api-gateway/cmd
RUN go build -mod=readonly -o /out/camera-proxy   ./host/services/camera-proxy
RUN go build -mod=readonly -o /out/capture-daemon ./host/services/capture-daemon

# 5) (Optional) final stage
FROM alpine:3.18
COPY --from=builder /out/ /usr/local/bin/
ENTRYPOINT ["api-gateway"]   # or whatever your default is