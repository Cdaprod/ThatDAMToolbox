# EVENTS.md

# ThatDAMToolbox Event Contract

This document catalogs **all event types** published and consumed within the ThatDAMToolbox platform.  
These events are delivered over the central event bus (RabbitMQ topic `events`), and form the backbone for service communication, UI updates, automation agents, and observability.

-----

## Conventions

- All events are published as **JSON objects**.
- Each event has a **topic** (used as the AMQP routing key, e.g. `capture.device_list`).
- Each payload should include at least:
  - `service` (emitter service name)
  - `ts` (ISO timestamp)
  - `v` (schema version, optional but recommended)
- Some events may include `trace_id`, `request_id`, or `correlation_id` for tracing.
- **Event schemas are versioned** and can be safely extended with new fields.

### Tenant Logging & Audit

- Middleware in Go and Python services appends `tenant_id` and `principal_id`
  to all log entries.
- Requests emit `tenant.*` events on the message bus. These are also written to
  `data/audit.log` as an immutable trail.
- Event payloads **must** include both identifiers:
  - `tenant_id` – logical tenant namespace
  - `principal_id` – authenticated user or agent


-----

## Event Topics

### 1. `capture-daemon` Service

#### `capture.alive`

> Emitted once upon successful start and AMQP connection. Used for system alignment, heartbeat, and initial state sync.

- **Payload:**
  - `service` (string, always "capture-daemon")
  - `version` (string, service version/Git SHA)
  - `ts` (ISO timestamp)
  - `devices` (array of current device summaries, can be empty)

#### `capture.device_list`

> Emitted periodically (on scan, on change, or on request).  
> Describes all attached and known capture devices.

- **Payload:**
  - `service`
  - `ts`
  - `devices` (array: see schema below)

#### `capture.recording_started`

> Emitted when a device starts recording (ffmpeg loop starts).

- **Payload:**
  - `device` (string, e.g., "/dev/video0")
  - `file` (string, output path)
  - `ts`
  - `service`

#### `capture.recording_stopped`

> Emitted when a device recording stops (graceful or error).

- **Payload:**
  - `device`
  - `file`
  - `ts`
  - `service`
  - `reason` (string, optional: "manual", "error", etc.)

#### `capture.error`

> Emitted on fatal error, device failure, or ffmpeg crash.

- **Payload:**
  - `service`
  - `ts`
  - `error` (string)
  - `context` (object, optional)

-----

### 2. `video-api` Service

#### `video.ingest_job_created`

> Emitted when a new ingest job is created for a recorded or uploaded video.

- **Payload:**
  - `job_id` (string/UUID)
  - `video_path` (string)
  - `source` (string: "recording"|"upload")
  - `ts`
  - `service`

#### `video.ingest_job_completed`

> Emitted when an ingest job is complete (file indexed, preview/metadata extracted).

- **Payload:**
  - `job_id`
  - `video_path`
  - `ts`
  - `service`
  - `result` (object: e.g., metadata summary)

#### `video.error`

> Emitted on ingest errors, database faults, etc.

- **Payload:**
  - `service`
  - `ts`
  - `error` (string)
  - `context` (object, optional)

#### `video.ready`

> Emitted on service startup, ready to serve HTTP API.

- **Payload:**
  - `service`
  - `version`
  - `ts`
  - `health` (object: e.g., status, DB connection, etc.)

-----

### 3. `video-web-app` (Frontend)

#### `webapp.alive`

> Emitted when web UI starts (optional, if you want frontends to self-register).

- **Payload:**
  - `service` (string: "video-web-app")
  - `version`
  - `ts`
  - `user_agent` (optional)

#### `webapp.user_action`

> Emitted on high-value user actions (optional: e.g., start/stop recording, upload, search).

- **Payload:**
  - `service`
  - `ts`
  - `action` (string)
  - `context` (object, optional)

#### `webapp.error`

> Emitted on frontend errors or failed API calls.

- **Payload:**
  - `service`
  - `ts`
  - `error`
  - `context` (object)

-----

## Schemas

### Device Summary (`devices` array)

```json
{
  "id": "/dev/video0",
  "kind": "v4l2",
  "path": "/dev/video0",
  "name": "UVC Camera (Logitech C920)",
  "capabilities": {
    "resolutions": ["1920x1080", "1280x720"],
    "fps": [30, 60],
    "formats": ["YUYV", "MJPEG", "H264"],
    "audio": false
  },
  "status": "online", // or "offline"
  "last_seen": "2025-08-04T14:33:09Z"
}
```

-----

## Example Payloads

### 1. `capture.alive`

```json
{
  "service": "capture-daemon",
  "version": "1.1.4",
  "ts": "2025-08-04T14:33:09Z",
  "devices": []
}
```

### 2. `capture.device_list`

```json
{
  "service": "capture-daemon",
  "ts": "2025-08-04T14:33:13Z",
  "devices": [
    {
      "id": "/dev/video0",
      "kind": "v4l2",
      "path": "/dev/video0",
      "name": "UVC Camera (Logitech C920)",
      "capabilities": {
        "resolutions": ["1920x1080", "1280x720"],
        "fps": [30, 60],
        "formats": ["YUYV", "MJPEG", "H264"]
      },
      "status": "online",
      "last_seen": "2025-08-04T14:33:13Z"
    }
  ]
}
```

### 3. `capture.recording_started`

```json
{
  "service": "capture-daemon",
  "ts": "2025-08-04T14:34:00Z",
  "device": "/dev/video0",
  "file": "/records/video0-h264-20250804T143400Z.mp4"
}
```

### 4. `video.ingest_job_created`

```json
{
  "service": "video-api",
  "ts": "2025-08-04T14:34:09Z",
  "job_id": "c023e9d0-f3a2-4a1d-8d6d-9e2a568a7bba",
  "video_path": "/records/video0-h264-20250804T143400Z.mp4",
  "source": "recording"
}
```

-----

## Notes & Evolution

- Add new events here as you build.
- For agent-driven systems, treat this contract as a living API. Always update with event topic, publisher, consumers, schema, and example.
- Consider publishing this to docs for contributors, AI agents, and integrators.

-----

*Generated for ThatDAMToolbox*  
*Version: 2025-08-04*