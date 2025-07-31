# Camera Agent (That DAM Toolbox)

#### Author: David Cannan

A lightweight Python agent that turns any device with a camera into a remote video source for the That DAM Toolbox system. The agent automatically discovers gateways via mDNS, registers itself, and streams JPEG frames over WebSocket.

⸻

## What it does

- **Auto-discovery** – Finds That DAM Toolbox gateways advertising `_thatdam._tcp` via mDNS
- **Self-registration** – Registers with the gateway and persists credentials locally
- **Video streaming** – Captures frames from `/dev/video*` and streams over WebSocket
- **Persistent config** – Saves registration info to `/data/agent.yaml` for reconnects
- **Resilient reconnection** – Exponential backoff reconnection with clean shutdown
- **Minimal footprint** – Runs anywhere Python + OpenCV can run

⸻

## Folder layout

```
docker/camera-agent/
├── Dockerfile                           # Python 3.10 + OpenCV + deps
├── camera_agent.py                      # main agent script
├── requirements.txt                     # Python dependencies
├── docker-compose.video-cam-agent.yaml  # compose service definition
└── README.md                            # you are here
```

⸻

## 1 ↦ How it works

### Discovery & Registration Flow

1. **Load existing config** from `/data/agent.yaml` (if present)
1. **mDNS discovery** – Scan for `_thatdam._tcp.local.` services
1. **Fetch well-known** – Get registration token from `/.well-known/thatdam.json`
1. **Register device** – POST to `/api/devices/register` with device info
1. **Persist credentials** – Save device ID and gateway info locally
1. **Start streaming** – Connect to WebSocket and begin frame transmission

### Video Pipeline

```
Camera → OpenCV → JPEG encode → Base64 → WebSocket → Gateway → Video API
```

The agent captures frames at configurable resolution/FPS, encodes as JPEG with quality=80, base64 encodes for JSON transport, and sends over WebSocket with timestamp metadata.

⸻

## 2 ↦ Configuration

### Environment Variables

|Variable          |Default   |Description                            |
|------------------|----------|---------------------------------------|
|`DATA_DIR`        |`/data`   |Persistent storage for agent config    |
|`DEVICE_SERIAL`   |`hostname`|Unique device identifier               |
|`VIDEO_DEVICE_IDX`|`0`       |Camera device index (`/dev/video0`)    |
|`FRAME_W`         |`640`     |Frame width in pixels                  |
|`FRAME_H`         |`360`     |Frame height in pixels                 |
|`FPS`             |`10`      |Frames per second                      |
|`GATEWAY_URL`     |(none)    |Static gateway override (bypasses mDNS)|

### Persistent Configuration

The agent saves its registration to `/data/agent.yaml`:

```yaml
device_id: "cam-abc123"
gateway: "thatdamtoolbox.local"
# ... other registration metadata
```

This allows the agent to reconnect without re-registering after restarts.

⸻

## 3 ↦ Docker usage

### Build the image

```bash
cd docker/camera-agent
docker build -t camera-agent:latest .
```

### Run standalone

```bash
docker run -d \
  --name camera-agent \
  --device /dev/video0:/dev/video0 \
  -v camera-data:/data \
  -e DEVICE_SERIAL=pi-kitchen-cam \
  -e FRAME_W=1280 \
  -e FRAME_H=720 \
  camera-agent:latest
```

### Run with compose

```bash
# Set device hostname as unique ID
export HOSTNAME=$(hostname)

docker-compose -f docker-compose.video-cam-agent.yaml up -d
```

⸻

## 4 ↦ Development & Testing

### Manual gateway override

Skip mDNS discovery and connect directly:

```bash
docker run -it --rm \
  --device /dev/video0:/dev/video0 \
  -e GATEWAY_URL=192.168.1.100 \
  -e DEVICE_SERIAL=test-cam \
  camera-agent:latest
```

### Debug mode

Run interactively to see connection logs:

```bash
docker run -it --rm \
  --device /dev/video0:/dev/video0 \
  -v camera-data:/data \
  camera-agent:latest
```

### Testing without camera

Use a dummy video device or modify the script to use test patterns:

```bash
# Create a dummy video device (requires v4l2loopback)
sudo modprobe v4l2loopback video_nr=10 card_label="Dummy"
ffmpeg -re -f lavfi -i testsrc=size=640x480:rate=10 -f v4l2 /dev/video10

# Point agent to dummy device
docker run -it --rm -e VIDEO_DEVICE_IDX=10 --device /dev/video10 camera-agent:latest
```

⸻

## 5 ↦ Network requirements

### mDNS Discovery

The agent needs to be on the same network as the gateway for mDNS discovery to work. This includes:

- **Same subnet** – Both devices on 192.168.1.x, 10.0.0.x, etc.
- **mDNS enabled** – Most home networks support this by default
- **No mDNS blocking** – Some enterprise networks block multicast

### WebSocket Connection

The agent connects to the gateway’s WebSocket endpoint:

```
ws://gateway-host:8080/ws/camera?deviceId=<device-id>
```

Ensure port 8080 is accessible from the agent’s network location.

⸻

## 6 ↦ Deployment scenarios

### Home Network Setup

Multiple Pi cameras throughout a house:

```bash
# Kitchen Pi
docker run -d --name kitchen-cam \
  --device /dev/video0 \
  -v kitchen-cam-data:/data \
  -e DEVICE_SERIAL=kitchen-pi \
  camera-agent:latest

# Garage Pi  
docker run -d --name garage-cam \
  --device /dev/video0 \
  -v garage-cam-data:/data \
  -e DEVICE_SERIAL=garage-pi \
  camera-agent:latest
```

### Mobile/Hotspot Setup

Agent running on a Pi connected to a phone’s hotspot, streaming to a That DAM Toolbox gateway on the same hotspot network.

### Edge Computing

Camera agents in remote locations connecting back to a central gateway over VPN or direct internet connection (using `GATEWAY_URL` override).

⸻

## 7 ↦ Troubleshooting

### No gateway discovered

```bash
# Check mDNS is working
avahi-browse -rt _thatdam._tcp

# Use static gateway as fallback
docker run -e GATEWAY_URL=192.168.1.100 camera-agent:latest
```

### Camera not accessible

```bash
# List available cameras
ls -la /dev/video*

# Test camera manually
ffmpeg -f v4l2 -i /dev/video0 -t 10 test.mp4

# Check permissions
docker run --device /dev/video0 -it camera-agent:latest ls -la /dev/video0
```

### WebSocket connection issues

```bash
# Test WebSocket endpoint manually
wscat -c ws://gateway-host:8080/ws/camera?deviceId=test

# Check gateway logs
docker logs thatdam-gateway
```

### Registration failures

```bash
# Check well-known endpoint
curl http://gateway-host/.well-known/thatdam.json

# Verify registration endpoint
curl -X POST http://gateway-host/api/devices/register \
  -H "Content-Type: application/json" \
  -H "X-Token: your-reg-token" \
  -d '{"serial":"test","model":"test"}'
```

⸻

## 8 ↦ Advanced configuration

### Custom video settings

```bash
# High quality 1080p at 30fps
docker run \
  -e FRAME_W=1920 \
  -e FRAME_H=1080 \
  -e FPS=30 \
  camera-agent:latest

# Low bandwidth 480p at 5fps  
docker run \
  -e FRAME_W=640 \
  -e FRAME_H=480 \
  -e FPS=5 \
  camera-agent:latest
```

### Multiple cameras per device

Run multiple agent containers with different device indices:

```bash
# Camera 0
docker run -d --name cam0 \
  --device /dev/video0 \
  -e VIDEO_DEVICE_IDX=0 \
  -e DEVICE_SERIAL=pi-cam0 \
  -v cam0-data:/data \
  camera-agent:latest

# Camera 1  
docker run -d --name cam1 \
  --device /dev/video1 \
  -e VIDEO_DEVICE_IDX=1 \
  -e DEVICE_SERIAL=pi-cam1 \
  -v cam1-data:/data \
  camera-agent:latest
```

### Health monitoring

Add health checks to your compose file:

```yaml
services:
  camera-agent:
    image: camera-agent:latest
    healthcheck:
      test: ["CMD", "python", "-c", "import cv2; cap = cv2.VideoCapture(0); print('OK' if cap.isOpened() else exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
```

⸻

## Done!

Your camera agent will automatically discover and connect to nearby That DAM Toolbox gateways, providing seamless video streaming with minimal configuration.

Key benefits:

- **Zero-config discovery** via mDNS
- **Persistent registration** survives restarts
- **Automatic reconnection** with exponential backoff
- **Lightweight** and resource-efficient
- **Cross-platform** runs on Pi, x86, ARM devices

Deploy anywhere there’s a camera and network connectivity! 📹🚀