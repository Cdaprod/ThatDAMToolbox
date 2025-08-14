# Supervisor API Contracts

Transport: HTTP one one or HTTP three later. Auth: api key for dev or jwt for prod.

POST /v1/nodes/register
- Req: node id, capabilities, host, ip, software versions
- Res: registered true
- Side effect: upsert node and emit overlay register

POST /v1/nodes/plan
- Req: node id
- Res: role, services array, control plane url, gateway url, epoch, ttl seconds

POST /v1/nodes/heartbeat
- Req: node id, role, services running, versions, optional metrics
- Res: no content
- Side effect: refresh ttl and emit overlay heartbeat

POST /v1/leader/claim
- Req: node id, url
- Res: granted bool, leader url, epoch

GET  /v1/leader
- Res: leader url, epoch or not found

GET  /v1/bootstrap/profile
- Res: Environment Profile document

GET  /v1/bootstrap/status?node_id=…
- Res: per component status and last generation

POST /v1/bootstrap/events
- Req: node id, component, action, status, message optional

