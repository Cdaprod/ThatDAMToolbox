# YouTube Script: Building the ThatDamToolbox Video Capture Appliance

## Video Overview

#### Target Length: 15–20 minutes
#### Style: Jeff Geerling–style technical deep-dive
#### Channel: @Cdaprod


*This is production-level, with exact time ranges, shot type for each segment, and the transcript you drafted (polished for clarity and natural voice).*

---

## YouTube Script Timeline Table

| Time        | Segment                  | Shot Type                      | Transcript (see below for each)                                        |
| ----------- | ------------------------ | ------------------------------ | ---------------------------------------------------------------------- |
| 0:00–1:30   | Intro & Demo             | Wide + Screen + B-roll         | [INTRO SEQUENCE](#intro-sequence)                                      |
| 1:30–3:00   | Architecture Overview    | Diagram + Hardware             | [ARCHITECTURE OVERVIEW](#architecture-overview)                        |
| 3:00–6:30   | Go Capture Daemon        | Code + Terminal + Hot-plug     | [PART 1: GO CAPTURE DAEMON](#part-1-go-capture-daemon)                 |
| 6:30–10:00  | Python API & Event Bus   | Code + Swagger + Logs          | [PART 2: PYTHON API & EVENT BUS](#part-2-python-api-event-bus)         |
| 10:00–13:00 | Next.js Frontend         | React + Browser + Mobile       | [PART 3: NEXT.JS FRONTEND](#part-3-nextjs-frontend)                    |
| 13:00–15:30 | Semantic Search/Weaviate | Schema + UI + Vector demos     | [PART 4: SEMANTIC SEARCH & WEAVIATE](#part-4-semantic-search-weaviate) |
| 15:30–17:30 | Docker & Deployment      | Compose + Pi demo              | [PART 5: DOCKER & DEPLOYMENT](#part-5-docker-deployment)               |
| 17:30–19:00 | Conclusion & Next Steps  | Wide + B-roll + Call to Action | [CONCLUSION & NEXT STEPS](#conclusion-next-steps)                      |

---

## Segment-by-Segment Transcript

### INTRO SEQUENCE

> "Hey everyone, I’m David from Cdaprod. Today we’re assembling a fully self-contained, browser-driven video capture appliance using Raspberry Pi (or any Linux box), a Go-based capture daemon, a Python/FastAPI backend, and a Next.js frontend, all talking over a unified event bus and indexed in Weaviate for semantic search.
>
> We’ll show you how to:
>
> 1. Discover and manage /dev/video\* devices dynamically in Go
> 2. Stream and record with ffmpeg, reporting capture.recording\_started and capture.recording\_stopped events
> 3. Wire events into our Python Video-API (video/bootstrap.py + video/core/event)
> 4. Build a Next.js UI (web-app/src) that previews, controls, and searches recordings in real time
> 5. Index all segments in Weaviate with a custom schema for natural-language queries
>
> By the end, you’ll have a portable appliance--just plug in HDMI, point your browser, and you’re live. Let’s dive in!"

---

### ARCHITECTURE OVERVIEW

> "Here’s the four-layer architecture of ThatDamToolbox:
>
> **Layer 1: Hardware & v4l2 Devices**
> HDMI-to-CSI or USB capture card → /dev/videoX (we’ll also show v4l2loopback for virtual feeds, and even NDI sources as pseudo-cameras).
>
> **Layer 2: Go Capture Daemon**
> host/services/capture-daemon scans /dev/video\*, launches ffmpeg loops (runner/ffmpeg.go), auto-retries, and publishes events on capture.recording\_started / capture.recording\_stopped via our built-in broker or RabbitMQ.
>
> **Layer 3: Python Video-API & Workers**
> video/bootstrap.py initializes FastAPI + video/core/event bus → video/modules/hwcapture plugs in REST & WebSocket routes (/ws/control, /ws/camera, /preview).
>
> On capture.segment.created we ingest segments into SQLite/MediaDB and push metadata to Weaviate.
>
> **Layer 4: Next.js Frontend**
> docker/web-app/src React components for device list, live MJPEG & WebRTC, recording controls, and semantic search powered by Weaviate.
>
> The glue is our Event-Driven Architecture:
> All services speak the same Event{topic, payload, ts} envelope. Whether in-process or over RabbitMQ, events flow instantly: Go → Python → Browser → Workers. No polling, no stale state."

---

### PART 1: GO CAPTURE DAEMON

> "Let’s start in Go with the capture-daemon. The heart is scanner.System (see system.go) which uses broker.IsCaptureNode to filter only video nodes. When a new device shows, we call runner.RunCaptureLoop:
>
> // runner/ffmpeg.go → RunCaptureLoop
> broker.Publish("capture.recording\_started", map\[string]any{…})
> cmd := exec.CommandContext(cmdCtx, cfg.FFmpegPath, args…)
> // …
> broker.Publish("capture.recording\_stopped", map\[string]any{…})
>
> It auto-retries up to 5 failures, then marks the device offline. Let’s demo:
>
> \$ docker-compose up capture-daemon
> \[ffmpeg] starting capture: /dev/video0 → /data/records/video0-h264-20250802T123456Z.mp4
>
> Unplugging and re-plugging shows dynamic device discovery--no container restart needed."

---

### PART 2: PYTHON API & EVENT BUS

> "Next, our Python layer--Video-API. In video/bootstrap.py we call init\_eventbus() to pick either:
>
> from video.core.event import get\_bus
> bus = get\_bus()  # in-process or aio-pika RabbitMQ
>
> We publish lifecycle.startup and register shutdown hooks.
>
> In video/modules/hwcapture/routes.py:
>
> @bus.subscribe("capture.recording\_stopped")
> async def on\_segment(evt):
> \# Save metadata, enqueue for ingestion
> await ingest\_segment(evt.payload\["file"])
> await bus.publish(Event(topic=Topic.CAPTURE\_SEGMENT\_CREATED, payload={…}))
>
> That triggers our ingestion worker to write to SQLite + Weaviate.
>
> Let’s call the REST API:
>
> \$ curl [http://localhost:8080/devices](http://localhost:8080/devices)
> \[{ "path": "/dev/video0", "name": "OBSBOT Tiny" }, …]
> \$ curl -XPOST [http://localhost:8080/start?device=/dev/video0](http://localhost:8080/start?device=/dev/video0)
>
> And watch the events in real time."

---

### PART 3: NEXT.JS FRONTEND

> "On the front end, web-app/src uses React hooks:
>
> ```js
> const ws = new WebSocket(process.env.NEXT_PUBLIC_WS_URL);
> ws.onmessage = (e) => {
>   const msg = JSON.parse(e.data);
>   if (msg.event === "recording_started") setRecording(true);
> };
> ```
>
> Device list, live MJPEG (/preview), and WebRTC (/ws/webrtc) are integrated.
>
> ```jsx
> <DeviceList devices={devices} onSelect={…}/>
> <LivePreview device={currentDevice}/>
> <RecordingControls onStart={…} onStop={…}/>
> <SearchPanel queryClient={…}/>
> ```
>
> Everything updates instantly when Go or Python fires an event--no polling needed."

---

### PART 4: SEMANTIC SEARCH & WEAVIATE

> "For rich search we use Weaviate. Here’s our schema.json:
>
> ```json
> {
>   "class": "VideoSegment",
>   "vectorizer": "text2vec-transformers",
>   "properties": [
>     { "name": "filename",   "dataType": ["string"] },
>     { "name": "duration",   "dataType": ["number"] },
>     { "name": "device",     "dataType": ["string"] },
>     { "name": "description","dataType": ["text"] },
>     { "name": "tags",       "dataType": ["string[]"] }
>   ]
> }
> ```
>
> On capture.segment.created, our Python worker calls Weaviate’s REST API to upsert the object with its embedding.
>
> ```python
> client.data_object.create(
>   {
>     "filename": fname,
>     "duration": dur,
>     …  
>   },
>   class_name="VideoSegment",
>   vector=embed
> )
> ```
>
> Now in the UI I can search "show clips from camera2 longer than 1 min" and get semantically relevant results."

---

### PART 5: DOCKER & DEPLOYMENT

> "Finally, let’s look at our Docker Compose config with YAML anchors for device access. In docker-compose.anchors.yaml:
>
> ```yaml
> x-video-cgroup: &video_cgroup
>   device_cgroup_rules:
>     - "c 81:* rmw"
>   group_add: ["44"]
>
> x-video-request: &video_request
>   device_requests:
>     - driver: "default"
>       count: -1
>       capabilities: ["video4linux"]
> ```
>
> And in docker-compose.capture-daemon.yaml:
>
> ```yaml
> services:
>   capture-daemon:
>     build: host/services/capture-daemon
>     <<: *video_request   # or *video_cgroup for older Compose
>     environment:
>       - OUT_DIR=/data/records
>     volumes:
>       - records:/data/records
> ```
>
> Now deploy on the Pi with:
>
> docker-compose -f docker-compose.anchors.yaml up -d
>
> You’ll see logs from Go, Python, RabbitMQ, Weaviate, and the React UI all coming online."

---

### CONCLUSION & NEXT STEPS

> "And that’s how you build a full-stack, event-driven video capture appliance--Go for real-time capture, Python for API & ingestion, Next.js for the browser, and Weaviate for semantic search.
>
> Use cases: field recording, live streaming, surveillance, game capture.
>
> Next up: AI-powered motion detection, cloud archiving, mobile apps, multi-camera sync, or live streaming to YouTube/Twitch.
>
> Check out the repo on GitHub (link below), star ★, and let me know what you build! Thanks for watching--see you next time."

---

### Technical Notes & Shoot Guidance

* **Reference paths:**

  * Go: `host/services/capture-daemon/runner/ffmpeg.go` and `scanner/system.go`
  * Python FastAPI: `video/bootstrap.py` & `video/core/event`
  * React: `docker/web-app/src`
  * Weaviate: schema in `docker/weaviate/schema.json`
  * Docker Compose: `device_requests` or `device_cgroup_rules`
* **Audio:** Use a lavalier or quality mic for the intro/outro.
* **Screen recording:** Capture at 1080p minimum, use cursor highlighting in code.
* **Lighting:** Consistent, no glare.
* **Props:** Raspberry Pi, SSD, HDMI/USB capture cards--show all in b-roll.

---

### Copy-Paste Markdown Table for Description/Planning

```markdown
| Time        | Segment                     | Shot Type                   |
|-------------|----------------------------|-----------------------------|
| 0:00–1:30   | Intro & Demo                | Wide + Screen + B-roll      |
| 1:30–3:00   | Architecture Overview       | Diagram + Hardware          |
| 3:00–6:30   | Go Capture Daemon           | Code + Terminal + Hot-plug  |
| 6:30–10:00  | Python API & Event Bus      | Code + Swagger + Logs       |
| 10:00–13:00 | Next.js Frontend            | React + Browser + Mobile    |
| 13:00–15:30 | Semantic Search/Weaviate    | Schema + UI + Vector demos  |
| 15:30–17:30 | Docker & Deployment         | Compose + Pi demo           |
| 17:30–19:00 | Conclusion & Next Steps     | Wide + B-roll + Call to Action |
```

---

If you want **each transcript line broken down to on-screen prompts, or a teleprompter script (one line at a time)** just say the word!
Or let me know if you want this in a Notion table, Google Sheets, or with extra "B-roll ideas" per segment.
Ready to shoot like a pro.
