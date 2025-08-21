# camera-proxy – AGENTS Guide

Scope: Exposes host cameras and relays capture-daemon previews over HTTP/WebRTC.

- Serves API and streams on :8000; `/viewer/` hosts static UI.
- Use capture-daemon for remote network feeds; this proxy only handles local hardware.
- Overlay client lives in `overlay.go`; register and heartbeat to supervisor when enabled.
- Keep main logic small; delegate to packages for discovery and streaming.
- TSN mode enabled via `TSN_*` env vars; service exits if config or PTP grandmaster
  validation fails.
- Test with `go test ./...` including overlay and stream handlers.
