# Multi-stage build for discovery service

FROM golang:1.21-alpine AS builder

# Install necessary packages

RUN apk add –no-cache git ca-certificates tzdata

# Set working directory

WORKDIR /app

# Copy go mod files

COPY go.mod go.sum ./

# Download dependencies

RUN go mod download

# Copy source code

COPY . .

# Build the application

RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o discovery-service .

# Final stage - minimal runtime image

FROM alpine:latest

# Install runtime dependencies

RUN apk add –no-cache   
ca-certificates   
curl   
docker-cli   
docker-compose   
avahi-tools   
bind-tools   
tailscale   
&& rm -rf /var/cache/apk/*

# Create non-root user

RUN adduser -D -s /bin/sh discovery

# Set working directory

WORKDIR /app

# Copy binary from builder

COPY –from=builder /app/discovery-service .

# Copy any additional files needed

COPY docker-compose.yaml /app/
COPY docker/ /app/docker/

# Make binary executable

RUN chmod +x discovery-service

# Switch to non-root user for security

USER discovery

# Health check

HEALTHCHECK –interval=30s –timeout=10s –start-period=5s –retries=3   
CMD curl -f http://localhost:9999/health || exit 1

# Expose health check port

EXPOSE 9999

# Start the discovery service

ENTRYPOINT ["./discovery-service"]