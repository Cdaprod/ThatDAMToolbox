# Reconcile Checklist

1. Fetch Environment Profile from Supervisor.
2. Storage: ensure bucket then versioning then lifecycle then tags.
3. Broker: ensure exchange then queue then binding then confirms.
4. Index: ensure class then add missing properties.
5. Start local services in plan order and wait for health.
6. Emit bootstrap events and write status. Repeat on a timer. All steps are idempotent.

If you want me to also generate minimal default adapters (filesystem storage, in-proc bus, in-mem index) as empty structs with method signatures, say the word and I'll add stubs in your /host/services/supervisor/internal/adapters tree so Codex can fill the internals.

---

## Environment Bootstrap (Idempotent Reconcile Spec)

Prime rule

Every apply step is safe to run repeatedly and order-independent. Treat desired config as truth; compute a diff; apply only missing pieces; never destructive by default.

0) Ports & reconcilers (hexagonal baseline)

Contracts (ports) the core depends on
•ObjectStorage: ensure bucket, set lifecycle/tags, put/get object.
•EventBus: ensure exchange/queue/binding, publish with idempotency key.
•VectorIndex: ensure class, add missing properties, upsert vectors.

Provide default adapters (FS storage, in-proc bus, in-mem index) so the system works with no external services. Swap to MinIO/RabbitMQ/Weaviate when available.

1) Storage (MinIO-compatible) -- idempotent apply recipe

Desired: list of buckets with lifecycle rules and tags.

Idempotent steps (per bucket):
1.Exists? If not, Create (MakeBucket). If exists, continue.
2.Versioning: If required=on and current=off → Enable. If on already → no-op.
3.Lifecycle: Fetch current rules; merge-add any missing rules by ID; never delete on default path.
4.Tags: Fetch tags; add/overwrite only the keys you manage; don't remove unknown tags.
5.Policy (optional): If you manage policy, set named policy only if absent or checksum differs.

Failure patterns to treat as no-op: "already exists", "not modified", "unknown tag key present".

Backoff & retries: exponential backoff with jitter; fail closed after N attempts; emit overlay.bootstrap.storage.{ok|error}.

2) Broker (RabbitMQ-compatible) -- idempotent apply recipe

Desired: exchanges, queues, and bindings per vhost.

Idempotent steps (per vhost):
1.ExchangeDeclare (durable=true, passive=false) – safe to repeat.
2.QueueDeclare (durable=true, passive=false) – safe to repeat.
3.QueueBind (queue, exchange, routing key) – safe to repeat.
4.Publisher confirms enabled for publish path (observability).
5.DLX / TTL (optional): declare dead-letter and policy by name; only add/update named policies you manage.

Never do by default: delete exchanges/queues/bindings; rename; purge.

Backoff & retries: reconnect with backoff; idempotency key on publish; emit overlay.bootstrap.broker.{ok|error}.

3) Vector index (Weaviate-compatible) -- idempotent apply recipe

Desired: classes with properties (non-destructive evolution).

Idempotent steps:
1.Class exists? If not, CreateClass.
2.Properties: For each desired property:
•If absent → AddProperty.
•If present but differs in type or indexing → log + skip (non-destructive path); emit a "needs migration" event.
3.Tenants (optional): Add any missing tenants; do not delete.

Never do by default: drop classes or properties; change property types.

Backoff & retries: standard; emit overlay.bootstrap.index.{ok|error}.

4) Reconcilers (execution order & safety)

Global order: storage → broker → index → start services.

Per reconciler:
•Read desired → Read actual → Diff → Apply adds/updates only.
•Record an apply generation hash; skip work if unchanged.
•Emit events to overlay.bootstrap.* with {component, action, status, message?, generation}.

Offline/air-gapped: fall back to default adapters (FS / in-proc / in-mem). When external service becomes reachable, reconcilers "fall forward" and sync.

5) Config detection & adapters (no hard deps)
•If MINIO_ENDPOINT present → use MinIO adapter; else FS adapter.
•If AMQP_URL present → use RabbitMQ adapter; else in-proc bus.
•If WEAVIATE_URL present → use Weaviate adapter; else in-mem index.
•Discovery picks adapters at boot; Supervisor provides desired spec; both remain operational without externals.

6) Observability & idempotency keys
•Include idempotency_key = sha256(node_id + component + generation + desired_hash) on any mutation/publish.
•Structured logs via logx with fields: component, action, attempt, idempotent, generation, duration_ms.
•Health surface: /internal/bootstrap/status reflects last apply per component.

7) Safety rails (non-destructive by design)
•Default reconcilers never delete or change types.
•"Destructive" mode is opt-in and guarded by a Supervisor intent (e.g., allow_destructive=true) and dry-run diff must be acknowledged.

8) Test matrix (quick)
•Cold start, no externals → FS/in-proc/in-mem only → all no-ops after first run.
•Cold start, with externals → create once → second run no-ops.
•Loss & recreate (delete a queue manually) → reapply adds it back.
•Schema evolution (add property) → property added; incompatible change emits "needs migration".

File layout (suggested; adapters optional now)

/docs/TECHNICAL/bootstrap-reconcile.md -- (paste this spec)

/host/services/supervisor/internal/ports/
•storage.go -- ObjectStorage (EnsureBucket, Put, Get, SetLifecycle, SetTags)
•bus.go -- EventBus (EnsureExchange, EnsureQueue, EnsureBinding, Publish)
•vector.go -- VectorIndex (EnsureClass, EnsureProperties, Upsert, Query)

/host/services/supervisor/internal/reconcile/
•storage_reconciler.go
•broker_reconciler.go
•index_reconciler.go
•engine.go (reads desired, runs reconcilers, emits events)

/host/services/supervisor/internal/adapters/
•storage_fs/ (default)
•storage_minio/ (optional)
•bus_inproc/ (default)
•bus_rabbitmq/ (optional)
•index_mem/ (default)
•index_weaviate/ (optional)

---

Minimal contracts (no implementations; safe for Codex)

/host/services/supervisor/internal/ports/storage.go

```go
// /host/services/supervisor/internal/ports/storage.go
package ports

import "context"

type BucketLifecycleRule struct {
ID        string
Prefix    string
ExpireDays int
}

type ObjectStorage interface {
EnsureBucket(ctx context.Context, name string) error
EnsureVersioning(ctx context.Context, name string, enabled bool) error
EnsureLifecycle(ctx context.Context, name string, rules []BucketLifecycleRule) error
EnsureTags(ctx context.Context, name string, tags map[string]string) error
}
```

/host/services/supervisor/internal/ports/bus.go

```go
// /host/services/supervisor/internal/ports/bus.go
package ports

import "context"

type Exchange struct {
Name string
Type string // topic, fanout, direct
}

type Queue struct {
Name string
TTL  int // seconds; 0 = none
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
```

/host/services/supervisor/internal/ports/vector.go

```go
// /host/services/supervisor/internal/ports/vector.go
package ports

import "context"

type ClassSpec struct {
Name       string
Properties []PropertySpec
}

type PropertySpec struct {
Name string
Type string // text, number, boolean, vectorRef, ...
}

type VectorIndex interface {
EnsureClass(ctx context.Context, c ClassSpec) error
EnsureProperties(ctx context.Context, class string, props []PropertySpec) error
UpsertVector(ctx context.Context, class, id string, vector []float32, meta map[string]any) error
}
```

---

Discovery apply order (one-screen checklist)
1.Read desired env from Supervisor.
2.Storage: ensure buckets → versioning → lifecycle → tags.
3.Broker: ensure exchange → queue → binding; enable confirms.
4.Index: ensure class → add missing properties.
5.Start/verify services; emit overlay.bootstrap.*.
6.Sleep; repeat -- idempotent.

---

Why this mirrors "how big OSS does it"
•S3/MinIO: bucket create, then non-destructive lifecycle/tag merges.
•RabbitMQ: declare ops are idempotent; re-declaring is the norm.
•Weaviate: schema changes are additive; destructive changes are migrations, not "apply".

If you want, I can follow up with tiny in-proc default adapters (FS, channels, in-mem) so you can run this reconcile loop with zero external services on a dev laptop -- and flip to MinIO/RabbitMQ/Weaviate by just setting env vars.

