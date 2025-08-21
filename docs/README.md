# Documentation

## Capability Matrix

| Capability | Proxy Viewer | DAM Explorer |
|------------|--------------|--------------|
| Live preview (WebRTC/HLS/MJPEG) | ✅ | ✅ |
| Start/stop local preview | ✅ | ✅ (if allowed) |
| Asset library/search | ❌ | ✅ |
| Ingest/import workflows | ❌ | ✅ |
| AI facets/annotations | ❌ | ✅ |
| Device pairing | ✅ | ✅ (admin) |
| Advanced admin | ❌ | ✅ |

## Adaptive Bitrate

Services stream video using an adaptive bitrate (ABR) ladder:

| Resolution | FPS | Bitrate |
|------------|-----|---------|
| 1920x1080  | 60  | 12 Mbps |
| 1920x1080  | 30  | 8 Mbps  |
| 1280x720   | 30  | 4 Mbps  |

The ladder can be configured per service to match network conditions.
