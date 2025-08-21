# Overlay Hub Design Note

## Purpose & Scope
- Acts as the network overlay control-plane for media flows.
- Abstracts physical networks into logical media lanes and selects paths with policy constraints.
- Manages node identity, flow authorization, and real-time topology awareness.

## External Contracts
### Publish
- **Request**: `POST /v1/publish`
  - Fields: `stream_id`, `class`, `preferred_transports`, `intent`.
- **Response**: `flow_contract` containing transport type, endpoints, keys, pacing targets, and overlay bindings.

### Subscribe
- **Request**: `POST /v1/subscribe`
  - Fields: `stream_id`, `viewer_class`, `preference`.
- **Response**: join instructions such as SDP + TURN info, SRT rendezvous, or RTP hints, plus ABR bounds.

### Re-route
- **Request**: `POST /v1/reroute`
  - Fields: `stream_id`, `reason`, current endpoints.
- **Response**: updated flow contract with new path and pacing directives.

### Telemetry
- **Request**: `POST /v1/telemetry`
  - Fields: RTT, jitter, loss, bitrate, queue depth.
- **Response**: 202 Accepted; may trigger async QoS updates.

### Lifecycle (capture-daemon)
- **Request**: `POST /v1/node/init`
  - Fields: node role, capabilities.
- **Response**: node identity, overlay addresses, default class settings.

## Policy Schema
- **Classes**: `focus`, `director`, `record`, `bulk` with specific latency and bandwidth targets.
- **ACLs**: per-tenant access lists for streams and nodes.
- **Tenant Isolation**: overlays and visibility partitioned by tenant.
- **Encryption**: SRTP/DTLS, AES for WireGuard/SRT enforced per class and tenant policy.

## Path Selection Logic
- **Inputs**: node directory, link metrics (RTT, jitter, loss, capacity), and live telemetry.
- **Scoring**: cost functions favoring latency or stability depending on flow class.
- **Decision Outcomes**: transport choice, endpoint set, pacing/ABR ceilings, and selected overlay edge.

## Operational Modes
1. **LAN-Direct**: direct WebRTC/SRT when peers share L2/L3.
2. **Overlay-Relay**: assigns TURN or edge relays when direct paths fail.
3. **Deterministic Wired**: enforces TSN/PTP pacing and rejects incompatible links.
4. **Roaming/Failover**: midstream reselection on mobility or congestion events.

## State Model
- **Node Directory**: identities, roles, capabilities, overlay addresses.
- **Topology Graph**: nodes, links, costs, freshness timestamps.
- **Flow Registry**: stream mappings to transports, endpoints, keys, class, and subscribers.
- **Policy Sets**: definitions for classes, ACLs, path preferences, encryption.
- **Audit Trail**: records of path decisions, reroutes, failures, and overrides.

## Observability
- **Metrics**: end-to-end latency, loss, jitter, bitrate, retransmits, reroute count.
- **Events**: overlay changes, alarms such as oversubscribed AP or path flapping.
- **SLOs**:
  - Focus: sub-200ms glass-to-glass.
  - Director: <500ms.
  - Record: best effort under 1s.
  - Bulk: throughput prioritized over latency.
