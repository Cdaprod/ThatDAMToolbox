# Supervisor API Contracts

Transport: HTTP/1.1 now; HTTP/3 optional later.
Auth: API key (dev) or JWT (prod, via JWKS).

POST /v1/nodes/register
- Req: node id, capabilities, host, ip, software versions
- Res: registered true
- Side effect: upsert node and emit overlay register

Example:
{
  "node_id": "n-abc123",
  "host": "rpi5-a",
  "ip": "192.168.1.20",
  "caps": { "cpu": 4, "ram_mb": 4096, "net_mbps": 300, "gpu": "none", "devices": 2 },
  "versions": { "discovery": "0.2.0", "agent": "0.4.1" }
}

POST /v1/nodes/plan
- Req: node id
- Res: role, services array, control plane url, gateway url, epoch, ttl seconds

Example:
{
  "role": "worker",
  "services": ["capture-daemon","camera-proxy"],
  "control_plane_url": "http://leader.local:8070",
  "gateway_url": "http://leader.local:8080",
  "epoch": 7,
  "ttl_seconds": 45
}

POST /v1/nodes/heartbeat
- Req: node id, role, services running, versions, optional metrics
- Res: no content
- Side effect: refresh ttl and emit overlay heartbeat

Example:
{
  "node_id": "n-abc123",
  "role": "worker",
  "services_running": ["capture-daemon","camera-proxy"],
  "metrics": { "cpu_pct": 0.31, "mem_pct": 0.42, "temp_c": 52.3 }
}

POST /v1/leader/claim
- Req: node id, url
- Res: granted bool, leader url, epoch

Notes: subject to lease/hysteresis; returns current leader if not granted.

GET  /v1/leader
- Res: leader url, epoch or not found
Example:
{ "leader_url": "http://leader.local:8070", "epoch": 7 }

GET  /v1/bootstrap/profile
- Res: Environment Profile document
Example (truncated):
{
  "storage": [{ "name": "media", "versioned": true }],
  "broker": {
    "exchanges": [{ "name": "overlay.events", "type": "topic" }],
    "queues": [{ "name": "overlay.q" }],
    "bindings": [{ "exchange": "overlay.events", "queue": "overlay.q", "key": "overlay.*" }]
  },
  "index": { "classes": [{ "name": "asset", "properties": [{"name":"title","type":"text"}] }] }
}

GET  /v1/bootstrap/status?node_id=…
- Res: per component status and last generation
Example:
{
  "node_id": "n-abc123",
  "components": {
    "storage": { "status": "ok", "generation": "g-12", "ts": "2025-08-14T03:12:10Z" },
    "broker":  { "status": "ok", "generation": "g-8",  "ts": "2025-08-14T03:12:11Z" },
    "index":   { "status": "ok", "generation": "g-5",  "ts": "2025-08-14T03:12:12Z" }
  }
}

POST /v1/bootstrap/events
- Req: node id, component, action, status, message optional
Notes: mirrored to AMQP as overlay.bootstrap.{component}.{ok|error}

## Tenancy API

Base URL: `TENANCY_URL` (default `http://localhost:8082`)

POST /login
- Header: `X-User-ID`
- Res: membership for caller

POST /tenants
- Req: name
- Header: `X-User-ID`
- Res: new tenant

POST /tenants/{tenant_id}/invite
- Req: user_id, role
- Header: `X-User-ID`
- Res: created membership

PATCH /memberships/{membership_id}
- Req: role
- Header: `X-User-ID`
- Res: updated membership
