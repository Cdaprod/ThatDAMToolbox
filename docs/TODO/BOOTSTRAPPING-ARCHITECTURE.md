perfect--here’s a single, drop-in spec that combines architecture bootstrapping + idempotent environment reconcile, stays control-plane oriented, and keeps all externals optional. I kept it abstract and implementation-agnostic so Codex can wire details.

/docs/TECHNICAL/BOOTSTRAP_ARCHITECTURE.md

# Control Plane Bootstrapping and Environment Reconcile

Goal: Any node can boot the same stack. Discovery and Supervisor determine roles and apply the desired environment without hard dependencies on external services. Everything is idempotent.

## 1. Boot Order and Roles

1) Discovery starts first on every node.
2) Discovery locates or self elects control plane.
   - Try mdns leader
   - Try cloud control url if set
   - Else self elect leader
3) Discovery registers with Supervisor and requests a plan.
4) Supervisor replies with role and service set.
   - leader or worker or proxy
   - control plane url and gateway url
   - ttl seconds and epoch
5) Discovery writes cluster json and starts or stops local services to match plan.
6) Discovery heartbeats at ttl thirds and re polls plan when notified.

## 2. Desired State Model

Supervisor publishes two read only documents:

- Cluster Plan: what services should run where and versions to target.
- Environment Profile: storage buckets, broker exchanges queues bindings, vector schema.

Agents and Discovery only apply what is relevant for their node.

## 3. Idempotent Reconcilers

Run in this order and safe to repeat:

A) Storage reconcile
- Ensure bucket exists
- Ensure versioning flag
- Merge add lifecycle rules by id
- Merge update managed tags
- Never delete by default

B) Broker reconcile
- Declare exchange durable
- Declare queue durable
- Bind queue to exchange with key
- Enable confirms for publish
- Never delete by default

C) Vector index reconcile
- Ensure class
- Add missing properties
- Log and skip incompatible type changes
- Never drop objects by default

Each reconciler reads desired, reads actual, computes diff, applies only additions or safe updates, emits overlay bootstrap events with generation hash.

## 4. Adapters and Defaults

Use ports and adapters pattern.

- ObjectStorage port: default file system adapter; optional MinIO adapter
- EventBus port: default in process pub sub; optional RabbitMQ adapter
- VectorIndex port: default in memory index; optional Weaviate adapter

Adapter selection is runtime based on env:

- MINIO endpoint present then use minio else fs
- AMQP url present then use rabbitmq else in proc
- WEAVIATE url present then use weaviate else in mem

All services can run with only defaults on a single node. When externals appear, reconcilers fall forward and sync.

## 5. Air Gapped and Offline

- Supervisor and or local object store serve all artifacts and profiles on the lan.
- Nodes cache last good desired and continue running when offline.
- On reconnect they reconcile to latest desired.

## 6. Safety and Observability

- Non destructive by default. Destructive operations require explicit intent and dry run diff.
- Idempotency key is sha256 of node id plus component plus generation plus desired hash.
- Logs include component action attempt idempotent generation duration ms.
- Health endpoint exposes last apply status per component.

## 7. Failure and Recovery

- 401 or 403 plan or heartbeat then re register
- 404 plan then re register and retry
- No supervisor found then self elect leader and advertise mdns
- Re locate control plane periodically
- If leader stale beyond ttl then next claimant wins via cas

/docs/TECHNICAL/BOOTSTRAP_APIS.md

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

/docs/DIAGRAMS/bootstrap-sequence.mmd

sequenceDiagram
    autonumber
    participant N as Node
    participant D as Discovery
    participant S as Supervisor
    participant GW as Api Gateway
    participant MQ as RabbitMQ

    Note over D: Boot and identify read or create node id

    D->>S: Register node
    S-->>D: Ok registered
    D->>S: Request plan
    S-->>D: Plan with role services epoch ttl and urls

    D->>D: Apply plan write cluster json start services

    D->>S: Heartbeat role and services running
    S-->>MQ: overlay heartbeat

    par Environment reconcile
        D->>S: Get environment profile
        D->>D: Reconcile storage then broker then index
        D->>S: Bootstrap events per component
    end

    Note over GW,S: Frontend reads logical state through gateway or supervisor

/docs/DIAGRAMS/bootstrap-architecture.mmd

graph TD

  subgraph Control_Plane [Control Plane]
    SUP["Supervisor registry and plan"]
    DISC["Discovery role logic"]
    MQ["RabbitMQ overlay events"]
  end

  subgraph Frontend [Frontend]
    WEB["Web App"]
    GW["Api Gateway"]
  end

  subgraph Agents [Agents and Devices]
    A1["Agent A capture and proxy"]
    A2["Agent B capture and proxy"]
    A3["Agent N capture and proxy"]
    DEV1["Devices A"]
    DEV2["Devices B"]
    DEVN["Devices N"]
  end

  %% Control wiring
  DISC --> SUP
  SUP --- MQ

  %% Agents to supervisor
  A1 --> SUP
  A2 --> SUP
  A3 --> SUP

  %% Devices contribute to logical pool
  DEV1 -.-> SUP
  DEV2 -.-> SUP
  DEVN -.-> SUP

  %% Frontend to control plane
  WEB --> GW
  GW --> SUP

  %% Styling minimal and safe
  style SUP fill:#e8f5e9,stroke:#2e7d32,stroke-width:1.2px
  style A1 fill:#e3f2fd,stroke:#1565c0
  style A2 fill:#e3f2fd,stroke:#1565c0
  style A3 fill:#e3f2fd,stroke:#1565c0
  style DEV1 fill:#fce4ec,stroke:#ad1457
  style DEV2 fill:#fce4ec,stroke:#ad1457
  style DEVN fill:#fce4ec,stroke:#ad1457

/host/services/supervisor/internal/ports/storage.go

// /host/services/supervisor/internal/ports/storage.go
// Abstract port for bucket and object concerns. Implementation may be filesystem or MinIO.
package ports

import "context"

type BucketLifecycleRule struct {
	ID         string
	Prefix     string
	ExpireDays int
}

type ObjectStorage interface {
	EnsureBucket(ctx context.Context, name string) error
	EnsureVersioning(ctx context.Context, name string, enabled bool) error
	EnsureLifecycle(ctx context.Context, name string, rules []BucketLifecycleRule) error
	EnsureTags(ctx context.Context, name string, tags map[string]string) error
}

/host/services/supervisor/internal/ports/bus.go

// /host/services/supervisor/internal/ports/bus.go
// Abstract port for messaging. Implementation may be in process or RabbitMQ.
package ports

import "context"

type Exchange struct {
	Name string
	Type string
}

type Queue struct {
	Name string
	TTL  int
	DLX  string
}

type Binding struct {
	Exchange string
	Queue    string
	Key      string
}

type EventBus interface {
	EnsureExchange(ctx context.Context, ex Exchange) error
	EnsureQueue(ctx context.Context, q Queue) error
	EnsureBinding(ctx context.Context, b Binding) error
	Publish(ctx context.Context, topic string, body []byte, idempotencyKey string) error
}

/host/services/supervisor/internal/ports/vector.go

// /host/services/supervisor/internal/ports/vector.go
// Abstract port for vector schema and upserts. Implementation may be in memory or Weaviate.
package ports

import "context"

type ClassSpec struct {
	Name       string
	Properties []PropertySpec
}

type PropertySpec struct {
	Name string
	Type string
}

type VectorIndex interface {
	EnsureClass(ctx context.Context, c ClassSpec) error
	EnsureProperties(ctx context.Context, class string, props []PropertySpec) error
	UpsertVector(ctx context.Context, class, id string, vector []float32, meta map[string]any) error
}

/docs/TECHNICAL/bootstrap-apply-checklist.md

# Reconcile Checklist

1. Fetch Environment Profile from Supervisor.
2. Storage: ensure bucket then versioning then lifecycle then tags.
3. Broker: ensure exchange then queue then binding then confirms.
4. Index: ensure class then add missing properties.
5. Start local services in plan order and wait for health.
6. Emit bootstrap events and write status. Repeat on a timer. All steps are idempotent.

If you want me to also generate minimal default adapters (filesystem storage, in-proc bus, in-mem index) as empty structs with method signatures, say the word and I’ll add stubs in your /host/services/supervisor/internal/adapters tree so Codex can fill the internals.