# Wireless HDMI Transmitter Architecture

The Wi-Fi HDMI transmitter stitches together existing services:

- [camera-proxy](../../../host/services/camera-proxy/README.md)
- [capture-daemon](../../../host/services/capture-daemon/README.md)
- [api-gateway](../../../host/services/api-gateway/README.md)
- [overlay-hub](../../../host/services/overlay-hub/README.md)
- [Hardware Capture Module](../../../video/modules/hwcapture/README.md)

## Timestamp discipline
Capture nodes stamp frames with a monotonic clock synchronised via gPTP. The
[timestamping helper](../../../video/modules/hwcapture/README.md) exposes the
capture clock so `camera-proxy` and `capture-daemon` can align audio and video.
All services accept a `TIME_SOURCE` override so a Precision Time Protocol grandmaster
can steer clocks across the network.

## Encoder matrix
| Device class | Encoder | Max resolution | Notes |
|--------------|---------|----------------|-------|
| Raspberry Pi 4 | MMAL H.264 | 1080p60 | Baseline profile, IDR every 0.5 s |
| x86 w/ VAAPI | VAAPI H.264/H.265 | 4K30 | Uses `FFMPEG_HWACCEL` hints |
| Nvidia Jetson | NVENC H.264/H.265 | 4K60 | Low‑delay preset, CBR |

## Transport descriptors
`camera-proxy` publishes several transports:

- **WebRTC** – browser‑friendly, SRTP over UDP with ICE negotiation.
- **SRT** – ARQ/FEC over UDP for dedicated apps.
- **LL-HLS** – chunked CMAF fallback when UDP paths fail.
- **NDI‑HX** – optional LAN mode for editor tooling.

## Registry schema
Streams register through the [api-gateway](../../../host/services/api-gateway/README.md)
and are advertised by the overlay registry:

```json
{
  "id": "cam1",
  "owner": "nodeA",
  "transports": ["webrtc", "srt"],
  "qos": "hd-60",
  "overlay": "hub1"
}
```

## QoS profiles
| Profile | Target | ABR ladder (Mbps) | Keyframe interval |
|---------|--------|-------------------|-------------------|
| `hd-60` | 1080p60 | 12, 8, 6 | 0.5 s |
| `hd-30` | 1080p30 | 8, 6, 4 | 1 s |
| `sd-30` | 720p30  | 4, 3, 2 | 1 s |

## TSN hooks
Time‑Sensitive Networking is optional. When `TSN_ENABLED=1`, `camera-proxy`
marks packets with 802.1Qav priorities and consults `overlay-hub` for
802.1AS clock state. Nodes without TSN support ignore these hints.

## Overlay‑hub decision logic
The [overlay-hub](../../../host/services/overlay-hub/README.md) scores each
registering agent using round‑trip time and offered bitrate. Agents exceeding
`150ms` RTT or lacking capacity are instructed to relay through a nearby peer;
otherwise they negotiate direct sessions.

## Telemetry‑based fallback criteria
`camera-proxy` reports packet loss and jitter to the hub every heartbeat. If
loss exceeds `5%` over three intervals or RTT rises above `200ms`, the hub
notifies clients to drop to SRT; continued degradation triggers LL‑HLS.

## Test methodology
1. Start services via compose and register a camera.
2. Measure glass‑to‑glass latency using a LED timer in frame.
3. Record packet loss and jitter from overlay telemetry.
4. Assert profile bitrates with `ffprobe` and check fallback triggers by
simulating loss with `tc netem`.

Automate these steps under `tests/wireless_hdmi/` to keep the pipeline
regression‑free.
