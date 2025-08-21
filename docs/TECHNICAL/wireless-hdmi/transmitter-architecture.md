# Wireless HDMI Transmitter Architecture

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
