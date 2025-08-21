# Hardware Capture Module

Streams video from V4L2 devices or NDI sources and exposes multiple preview transports.

## Features

- Switchable CSI/NDI preview
- Low‑latency HLS streaming
- WebRTC negotiation
- Multi‑camera recording helpers
- Witness camera synchronisation

## CSI and NDI Preview

```html
<img src="/api/v1/hwcapture/stream?device=/dev/video0" />
<img src="/api/v1/hwcapture/ndi_stream?source=MyNDICam" />
```

## HLS

```bash
curl -X POST "http://host:8080/hwcapture/hls?device=/dev/video0"
```
Serves `/hwcapture/live/stream.m3u8` and `.ts` segments.

## WebRTC

POST an SDP offer to `/hwcapture/webrtc` to negotiate a peer connection.  Feature flags are available via `/hwcapture/features`.

## Device aggregation

The `/hwcapture/devices` endpoint merges devices from three sources:

- `CAPTURE_DAEMON_URL` – capture-daemon's `/devices`
- `CAMERA_PROXY_URL` – camera-proxy's `/api/devices` (default `http://localhost:8000`)
- a local scan via `list_video_devices()`

Duplicates are removed by device path.

## Multi‑camera CLI

```bash
python hwcapture.py --devices /dev/video0 /dev/video1 --duration 60
```

## Witness Sync

```bash
python -m video witness_record --duration 10
```

Writes `main_raw.mp4` and a stabilised witness copy.


### See also
- [camera-proxy](../../../host/services/camera-proxy/README.md)
- [capture-daemon](../../../host/services/capture-daemon/README.md)
- [api-gateway](../../../host/services/api-gateway/README.md)
- [overlay-hub](../../../host/services/overlay-hub/README.md)
- [Wireless HDMI Transmitter Architecture](../../../docs/TECHNICAL/wireless-hdmi/transmitter-architecture.md)
