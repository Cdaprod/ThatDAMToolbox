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

> **Status:** Draft skeleton – fill in TODOs before implementation.

This document outlines the capture→encode→transport→registry→receive pipeline for HDMI over network transmission in That DAM Toolbox. It distinguishes legacy Python components from the refactored Go services and notes how overlay networking steers latency targets.

## 1. Capture
- **Services:** `host/services/camera-proxy`, `host/services/capture-daemon`
- Both services expose the same capture/forward capabilities.
- When `capture-daemon` is present, `camera-proxy` forwards its local feed into the daemon; otherwise it serves its own embedded proxy viewer.
- **Legacy:** `video/modules/hwcapture` (Python) retains reference timestamp logic.
- **TODO:** Document timestamp discipline, audio sync, and PTP integration.

## 2. Encoding
- Encoding lives in `camera-proxy` and `capture-daemon`.
- Provide modes for all‑I low delay, IPB GOP, and intra‑only profiles.
- Abstraction over hardware codecs (VAAPI, NVENC, V4L2, VideoToolbox).
- **TODO:** Fill encoder matrix (Pi, x86, GPU, ASIC) with latency targets and bitrate controls.

## 3. Transport Options
- **WebRTC:** Primary for browsers; requires ICE, DTLS, SRTP, and RTCP feedback.
- **SRT:** Tool integration; register stream IDs via `api-gateway`.
- **Custom RTP/UDP + PTP:** Deterministic wired lane; strict packet pacing.
- **TODO:** Define session descriptors (SDP) and jitter budgets per transport.

## 4. Signaling & Stream Registry
- `host/services/api-gateway` supplies registry and signaling.
- Maintains list of active transmitters and transport options.
- Video-api (Python) acts as plugin into `media-api` and `api-gateway`.
- **TODO:** Describe offer/answer flow, registry schema, and access control tokens.

## 5. Receiver Apps
- `docker/web-app` (Next.js) and `docker/proxy-viewer` are alternative UIs for the same role.
- Both consume feeds via `camera-proxy`/`capture-daemon` and share WebRTC/HLS protocols.
- **TODO:** Add subscription workflow and latency modes (director vs focus-pull).

## 6. QoS & Overlay Hub
- Overlay hub steers path selection and fan‑out, enabling predictable latency and multi-viewer scale.
- Network profiles: dedicated Wi‑Fi AP vs TSN/AVB wired segment.
- **TODO:** Outline ABR ladder definitions, feedback loops, and metrics endpoints.

## 7. Deterministic Wired Path
- TSN/AVB with PTP for single-digit millisecond latency.
- SMPTE 2110 style packet pacing; same code paths as Wi‑Fi with different network policies.
- **TODO:** Specify configuration hooks for TSN-capable NICs and switches.

## 8. Test Methodology
- Glass‑to‑glass latency gates per transport mode.
- Jitter tolerance and multi-viewer scaling tests.
- **TODO:** Provide step-by-step test plans and tooling references.

---

### Open Questions
- How does overlay hub influence dynamic path selection between Wi‑Fi and wired TSN?
- What telemetry drives automatic fallback from custom RTP to WebRTC/SRT?

---

*Edit this document as implementation details land. Keep sections scoped so parallel PRs can update discrete TODOs without merge conflicts.*
