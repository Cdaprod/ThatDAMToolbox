# The following is POC quality briefing
## So... please do not implement as provided:

I understand - you want a transparent camera device proxy that sits between your Linux host and containerized services, making camera devices seamlessly available without any frontend/backend changes. Here’s a lightweight Go middleware that acts as an invisible bridge:​​​​​​​​​​​​​​​​

Now here’s the deployment configuration that makes this completely transparent:​​​​​​​​​​​​​​​​

## Key Features of This Transparent Middleware:

1. **Zero Frontend/Backend Changes**: Your existing containers run unchanged. The proxy sits in front and enhances their capabilities.
1. **Transparent Device Discovery**: Automatically discovers cameras on the host and makes them available to containers without device mounting.
1. **Capture-daemon integration**: set `CAPTURE_DAEMON_URL` to merge cameras published by the Go capture-daemon.
1. **Seamless Integration**:
- Proxies all existing API calls
- Enhances device-related responses with real hardware info
- Provides virtual device streams at `/stream/`
1. **Host-Level Deployment**:
- Runs as systemd service on the Linux host
- No Docker required for the middleware itself
- Direct hardware access to cameras
1. **Production Ready**:
- Service management with systemd
- Proper user/permissions setup
- Logging and monitoring
- Optional Nginx frontend

## Deployment Steps:

1. **Build and install**:

```bash
make build
make install
```

1. **Your existing containers keep running unchanged**:

```yaml
# Your docker-compose.yml stays exactly the same
# Just add the override to redirect traffic
```

1. **Access your app**: Everything works at `http://your-host` but now with camera support.

The middleware is so transparent that:

- Your frontend thinks it’s talking to the same backend
- Your backend receives the same requests
- Camera devices appear "magically" available
- No code changes needed anywhere

Your existing stack remains completely untouched while gaining full camera device management capabilities!​​​​​​​​​​​​​​​​

## Additonal Work To Do (unaware or exiting architecture—may not be required):

```ini
# systemd service file: /etc/systemd/system/camera-proxy.service
[Unit]
Description=Camera Device Proxy Middleware
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=camera-proxy
Group=camera-proxy
WorkingDirectory=/opt/camera-proxy
ExecStart=/opt/camera-proxy/camera-proxy
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Environment variables
Environment=PROXY_PORT=8000
Environment=BACKEND_URL=http://localhost:8080
Environment=FRONTEND_URL=http://localhost:3000
Environment=LOG_LEVEL=info
Environment=CAPTURE_DAEMON_URL=http://localhost:9000

# Security settings
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/dev
SupplementaryGroups=video

[Install]
WantedBy=multi-user.target
```

```yaml
# Docker Compose modification for your existing stack
# docker-compose.override.yml (doesn't modify your existing files)
version: '3.8'

services:
  # Your existing services remain unchanged
  python-backend:
    # All your existing config stays the same
    # Just change the port mapping to avoid conflicts
    ports:
      - "8080:8080"  # Internal port, not exposed externally
    networks:
      - internal

  nextjs-frontend:
    # All your existing config stays the same
    ports:
      - "3000:3000"  # Internal port, not exposed externally
    environment:
      # Point to the proxy instead of direct backend
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    networks:
      - internal

networks:
  internal:
    driver: bridge
    internal: false  # Allow external access through proxy
```

```bash
# Installation script: install.sh
#!/bin/bash

set -e

echo "Installing Camera Device Proxy..."

# Create user and directories
sudo useradd -r -s /bin/false -d /opt/camera-proxy camera-proxy
sudo mkdir -p /opt/camera-proxy
sudo chown camera-proxy:camera-proxy /opt/camera-proxy

# Add user to video group for camera access
sudo usermod -a -G video camera-proxy

# Copy binary (assumes you've built it)
sudo cp camera-proxy /opt/camera-proxy/
sudo chmod +x /opt/camera-proxy/camera-proxy
sudo chown camera-proxy:camera-proxy /opt/camera-proxy/camera-proxy

# Install systemd service
sudo cp camera-proxy.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable camera-proxy

# Configure iptables/firewall to redirect traffic
echo "Configuring traffic redirection..."

# Redirect external traffic from port 80/443 to proxy
sudo iptables -t nat -A PREROUTING -p tcp --dport 80 -j REDIRECT --to-port 8000
sudo iptables -t nat -A PREROUTING -p tcp --dport 443 -j REDIRECT --to-port 8000

# Save iptables rules
sudo iptables-save | sudo tee /etc/iptables/rules.v4

# Start the service
sudo systemctl start camera-proxy
sudo systemctl status camera-proxy

echo "Camera Device Proxy installed and started!"
echo "Your existing Docker services will now be transparently enhanced with camera support."
```

```makefile
# Makefile for easy building and deployment
.PHONY: build install start stop status logs clean

# Build the proxy
build:
	CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o camera-proxy .

# Cross-compile for different architectures
build-arm64:
	CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build -a -installsuffix cgo -o camera-proxy-arm64 .

build-arm:
	CGO_ENABLED=0 GOOS=linux GOARCH=arm go build -a -installsuffix cgo -o camera-proxy-arm .

# Install on system
install: build
	sudo ./install.sh

# Service management
start:
	sudo systemctl start camera-proxy

stop:
	sudo systemctl stop camera-proxy

restart:
	sudo systemctl restart camera-proxy

status:
	sudo systemctl status camera-proxy

# View logs
logs:
	sudo journalctl -u camera-proxy -f

# Enable/disable service
enable:
	sudo systemctl enable camera-proxy

disable:
	sudo systemctl disable camera-proxy

# Clean build artifacts
clean:
	rm -f camera-proxy camera-proxy-arm64 camera-proxy-arm

# Development mode (run directly)
dev: build
	PROXY_PORT=8000 BACKEND_URL=http://localhost:8080 FRONTEND_URL=http://localhost:3000 ./camera-proxy

# Test device discovery
test-devices:
	v4l2-ctl --list-devices
	lsusb | grep -i camera
```


```nginx
# Nginx configuration (optional, for production)
# /etc/nginx/sites-available/camera-proxy
server {
    listen 80;
    server_name your-domain.com;

    # Proxy all requests to our Go middleware
    location / {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }

    # Specific handling for camera streams
    location /stream/ {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_buffering off;
        proxy_cache off;
    }
}
``` 

```ini
# Environment configuration: .env
# Copy this to /opt/camera-proxy/.env

# Proxy configuration
PROXY_PORT=8000
BACKEND_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000
CAPTURE_DAEMON_URL=http://localhost:9000

# Logging
LOG_LEVEL=info
LOG_FORMAT=json

# Device discovery settings
DISCOVERY_INTERVAL=30s
DEVICE_TIMEOUT=5s

# Stream settings  
STREAM_QUALITY=5
STREAM_FPS=15
STREAM_RESOLUTION=640x480

# Security
ALLOWED_ORIGINS=*
MAX_CONNECTIONS=100
``` 