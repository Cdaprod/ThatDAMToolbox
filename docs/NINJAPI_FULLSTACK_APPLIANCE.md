# NINJAPI Full-Stack Appliance

Below is a concrete, incremental blueprint for evolving the capture-daemon prototype into a full-stack "Pi Ninja" appliance that:

- mirrors the Atomos Ninja V live-monitor workflow,
- records + live-streams + AI-indexes video,
- exposes a browser UI that runs great on an iPhone, and
- doubles as a network DAM/explorer.

-----

## 0 · Reference Hardware

|Piece  |Suggested Pick                                                                 |Notes                                                                |
|-------|-------------------------------------------------------------------------------|---------------------------------------------------------------------|
|SBC    |Raspberry Pi 5 (8 GB)                                                          |PCIe USB-C power brick; use official cooler; enable fan governor.    |
|Capture|UVC HDMI→USB3 dongle (e.g. Magewell, Elgato Cam Link 4K, or cheaper UVC clones)|Shows up as /dev/video0 in 4-lane USB3 host port.                    |
|Storage|1-TB USB3 SSD (ExFAT)                                                          |Mount at /media/ssd; durable & fast.                                 |
|Display|iPhone browser + Pi 5 micro-HDMI for setup                                     |You won’t need a Pi-touchscreen: iPhone shows the same UI over Wi-Fi.|
|Network|Gig-E + 802.11ac                                                               |LAN when available, AP fallback.                                     |

-----

## 1 · Stack Layout (Docker Compose)

### Profiles / Services

```
┌───────────────────────────────┐
│ default                       │  video-api  – FastAPI/RTSP/HLS gateway
│                               │  video-web  – Next.js / React monitor UI
└───────────────────────────────┘
┌───────────────────────────────┐
│ capture-daemon     (opt-in)   │  capture-daemon – ffmpeg + registry
└───────────────────────────────┘
┌───────────────────────────────┐
│ inference          (opt-in)   │  yolo-worker  – ONNXRuntime / OpenVINO
│                               │  asr-worker   – Vosk / Whisper.cpp
└───────────────────────────────┘
┌───────────────────────────────┐
│ dam               (opt-in)    │  minio        – S3 object store
│                               │  pg-vector    – Postgres + pgvector
└───────────────────────────────┘
┌───────────────────────────────┐
│ bootstrap-host    (one-shot)  │  host-init    – inserts v4l2loopback if no cam
└───────────────────────────────┘
```

You already have bootstrap-host (host-init) and capture-daemon.
Add the other two optional profiles:

```yaml
# inference: lightweight AI workers
yolo-worker:
  image: ghcr.io/ultralytics/ultralytics:arm64
  command: ["detect", "stream", "--source", "rtsp://video-api:8554/live"]
  profiles: ["inference"]
  depends_on: [video-api]

# dam: storage + metadata
minio:
  image: quay.io/minio/minio:RELEASE.2025-06-10T00-00-00Z
  profiles: ["dam"]
  command: ["server","/data"]
  environment: 
    MINIO_ROOT_USER: admin
    MINIO_ROOT_PASSWORD: password
  volumes: 
    - "minio-data:/data"

pg-vector:
  image: tensorchord/pgvecto-rs:pg16
  profiles: ["dam"]
  environment: 
    POSTGRES_PASSWORD: dbpass
  volumes: 
    - "db-data:/var/lib/postgresql/data"
```

### Usage Examples

**Full production stack:**

```bash
docker compose --profile bootstrap-host --profile capture-daemon --profile inference --profile dam up -d
```

**Dev UI only (no camera):**

```bash
docker compose up -d
```

-----

## 2 · Live-Monitor Flow

```
         HDMI camera
              │
      ┌───────▼────────┐
      │ UVC capture    │   (/dev/video0)
      └───────┬────────┘
              │
 ┌────────────▼───────────────┐
 │ capture-daemon (ffmpeg)    │ records .mp4 → /records
 │                            │ + publishes RTSP 8554/live
 └────────────┬───────────────┘
              │
    ┌─────────▼──────────┐
    │  video-api         │  wraps RTSP into HLS + websockets
    │  (FastAPI + GStreamer) ─────► video-web (React) on iPhone
    └─────────▲──────────┘
              │
    ┌─────────▼──────────┐
    │  inference workers │  YOLO / ASR produce JSON events
    └────────────────────┘
```

-----

## 3 · Minimal Milestones

|Milestone        |Rough Steps                                                                                                                                   |
|-----------------|----------------------------------------------------------------------------------------------------------------------------------------------|
|M0 -- live preview|✅ you have capture-daemon & registry; add video-api (FastAPI) with simple /stream.m3u8 served by ffmpeg -f hls. video-web shows `<video>` tag.|
|M1 -- AI metadata |Add YOLO worker: subscribes to RTSP, posts detections to video-api /events. Store events in SQLite first.                                     |
|M2 -- DAM storage |Add MinIO + pg-vector; move mp4 files to MinIO after recording closes; index embeddings for text/object search.                               |
|M3 -- Multicamera |support multiple /dev/video*; web UI shows grid; ffmpeg loops use GPU h264 encoder (v4l2-request on Pi 5).                                    |
|M4 -- Reliability |systemd wrapper for Compose, health-check restart, AP fallback hotspot.                                                                       |

-----

## 4 · Example ffmpeg Launch (Pi 5 HW Encode)

```bash
ffmpeg -f v4l2 -input_format yuv420p -framerate 30 -video_size 1920x1080 \
       -i /dev/video0 \
       -c:v h264_v4l2m2m -b:v 8M -f tee \
       "[f=segment:segment_time=300]/records/cam0-%Y%m%dT%H%M%S.mp4|[f=rtsp]rtsp://0.0.0.0:8554/live"
```

Hardware encoder keeps CPU free for AI workers.

-----

## 5 · Tips & "Gotchas"

- **UVC buffer tuning on Pi 5:**  
  `usbcore.quirks=0bda:****:u` in `/boot/cmdline.txt` can fix some cheap dongles.
- **Thermals:**  
  ffmpeg (h264_v4l2m2m) + on-device YOLO will push temps → enable fan or limit FPS.
- **Web UI latency:**  
  use HLS + low-latency chunked transfer (`hls_flags=delete_segments+temp_file`) or LL-DASH if you need <1 s.
- **iPhone fullscreen:**  
  add `playsInline` & `muted` attributes in React video tag to allow autoplay.

-----

## 6 · Next Actions for You

1. **Add the Dockerfile for video-api** (Python FastAPI + GStreamer).
1. **Copy the Compose snippets above** into `/docker-compose.yml` under new profiles.
1. **Commit a Makefile target:**

```makefile
stack-up:  # first boot
	docker compose --profile bootstrap-host \
                 --profile capture-daemon \
                 --profile inference up -d
```

1. **Iterate M0 → M4**, measuring Pi 5 load (`htop` + `vcgencmd measure_temp`).
1. **When stable, 3D-print a case** with SSD holder & HDMI clamp -- congrats, you have a DIY Ninja V replacement.

Happy hacking!