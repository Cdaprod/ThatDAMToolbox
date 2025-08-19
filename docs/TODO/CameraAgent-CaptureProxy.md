“Camera Proxy” vs “Camera Agent”

# What We Want is:

**What we want:** A streamlined live streaming architecture that delivers professional-grade capture with minimal latency distribution.

**Core Components:**

- **Mini-SFU with WHIP/WHEP support** - Acts as our intelligent relay layer, accepting incoming streams via WHIP and distributing them to viewers through WHEP endpoints
- **Zero re-encoding proxy** - Maintains original H.264 quality by passing through the publisher’s stream without transcoding overhead
- **Multi-client distribution** - Enables simultaneous access for directors and viewers across the LAN without impacting source quality
- **Dual recording strategy** - Captures high-fidelity masters (ProRes/FFV1) at the daemon level while serving low-latency H.264 streams to live viewers

**Benefits:**

- **Minimal latency** - WHEP protocol ensures near-real-time delivery to viewers
- **Quality preservation** - No degradation from re-encoding during live distribution
- **Scalable viewing** - Support for multiple concurrent viewers without affecting source performance
- **Professional archival** - High-quality master recordings maintained separately from live streams

This architecture separates concerns cleanly: professional capture and archival happen at the source, while the SFU handles efficient, low-latency distribution to live audiences.​​​​​​​​​​​​​​​​

Dimension	camera-proxy (host/services/camera-proxy, Go)	camera-agent (docker/camera-agent, Python)
Primary role	• Gateway-side shim that augments an existing backend: – enumerates local /dev/video* & capture-daemon feeds – exposes them via /api/devices, /stream/…, WS passthrough• Runs once per node that already hosts the API or Nginx	• Edge/leaf producer that turns any Linux box/Pi into a remote camera – discovers gateway (mDNS) → registers → pushes JPEG WS frames• Runs one per physical camera device (often on a separate Pi Zero 2 W)
Data direction	Pull / proxy; never owns a camera, just forwards	Push / source; originates the video frames
Network topology	Same LAN as API; often host-network on the NUC/Pi-5 that already serves :80/:443	Anywhere that can reach gateway :8080 WS (LAN, Wi-Fi AP, VPN)
Hardware access	Needs v4l2 (+ optional /dev pass-through) and may need elevated caps (setgid video, SYS_ADMIN ioctl)	Needs /dev/videoN on its own host; no privileged flags once inside the container
Language/runtime	Go 1.22 – zero-dep static binary	CPython 3.10 + OpenCV + websockets
Resource profile	<15 MB RSS, negligible CPU except during MJPEG encoding	35-70 MB RSS; CPU proportional to JPEG fps/quality
Failure blast-radius	Affects only gateway camera listings; backend keeps running	Drops an individual feed; all other feeds unaffected
Typical host	• “Central” Pi 5 with SSD• x86_64 NUC running the full stack	• Pi Zero 2 W hanging off a USB cam• Jetson Nano near an IP cam
Complementarity	Optional; stack works without it (just lacks hot-plug magic)	Optional; stack works without it (only local cams visible)


⸻

When do I choose which?
	1.	Single-box dev setup (laptop / NUC):
Run neither – just mount /dev/video0 into the video-api container.
	2.	Self-hosted Pi-5 “hub” + USB cams plugged directly in:
Deploy camera-proxy on the hub so the FastAPI container remains device-agnostic and can still hot-plug cams.
	3.	Distributed cameras (garage, garden, studio) feeding one gateway:
Deploy camera-agent on each satellite Pi; the gateway may or may not also run camera-proxy for its own local cams.
	4.	Enterprise / K8s cluster where no pod may touch /dev/video*:
Deploy camera-proxy as a host-service (systemd) on every worker that has cameras; inside the cluster no pod gets privileged flags.

Rule of thumb:

Proxy lives with the backend, surfacing whatever devices that host already owns.
Agent lives with the device, pushing the feed to the backend.

They’re complementary, not mutually exclusive.

⸻

Production packaging & release strategy

camera-proxy (Go)

Goal	Packaging choice	Rationale
Tiny rootless container	Multi-arch OCI imageghcr.io/cdaprod/camera-proxy:<tag> built by Buildx → distroless base	• <10 MB image• Works in any Docker/Podman/compose stack
Direct host install	Static binary (camera-proxy_<ver>_linux_<arch>.tar.gz) + .deb built with nfpm	• Lets you run under systemd without Docker (one binary + one unit file)• No GLIBC dependency – drops anywhere (Pi OS, Alpine, NixOS)
Home-brew tap / Scoop bucket	Optional convenience	macOS/Windows devs can run the proxy locally for UI tests

Build artefacts:

make build-images                     # OCI, :dev tag
GOOS=linux GOARCH=arm64 make build    # drop-in binary for Pi

CI tag-on-push publishes:
	•	camera-proxy-v0.4.3-linux-arm64
	•	camera-proxy-v0.4.3-linux-amd64
	•	ghcr.io/cdaprod/camera-proxy:v0.4.3 (manifest list)

⸻

camera-agent (Python)

Goal	Packaging choice	Rationale
Appliance-style container	ghcr.io/cdaprod/camera-agent:<tag> multi-arch	• Pull-and-run on any Pi/Nano:docker run --device /dev/video0 ghcr.io/…/camera-agent:<tag>
Standalone script on raspbian-lite	PyInstaller one-file exe ∼ 8 MB	• Lets hobbyists install with `curl
APT repo	Optional; camera-agent deb that drops /usr/bin/camera-agent + systemd unit	• Seamless OTA upgrade via apt update && apt upgrade

The container is the default; PyInstaller build is a nice-to-have for truly minimal images (e.g. Alpine on OpenWrt routers).

⸻

Release checklist (proxy & agent)
	1.	Tag semantic version in git → CI job triggers.
	2.	Buildx matrix (linux/amd64, linux/arm64, optional linux/arm/v7).
	3.	Push manifest list to GHCR.
	4.	Attach static binaries / PyInstaller one-file to the GitHub Release.
	5.	Generate SBOM (cosign attest --type spdx), sign image.
	6.	Publish changelog snippet to docs/TECHNICAL/AGENTS.md and Discord.

⸻

TL;DR
	•	camera-proxy – tiny Go binary/container that exposes local cams; ship it as both a distroless OCI image and a static tarball/.deb for systemd installs.
	•	camera-agent – Python push client that originates a feed; default to a multi-arch container, with an optional PyInstaller single-file for ultra-light edge nodes.

Choose proxy when the box already hosts your backend and you want hot-plug discovery without touching containers; choose agent when the camera lives elsewhere and must push to the gateway.