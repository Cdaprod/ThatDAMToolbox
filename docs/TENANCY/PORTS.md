Port: Storage
•EnsureTenant(t, plan.storage) → idempotent convergence to bucket(s), versioning, policy, audit hook.
•Validate(t) → fast health & capability probe for SLOs.
•Must support: per-tenant access policy, audit event webhook, server-side encryption policy.

Port: Queue
•EnsureTenant(t, plan.queue) → declares per-tenant exchanges/queues, DLX, tracing.
•Validate(t) → publish/consume probe with envelope verification.
•Must support: per-tenant namespace (vhost or scoped names), quorum queues when permitted.

Port: Audit
•Emit(event) → signed, append-only semantics; supports batching.
•Guarantees: UTC timestamps, request/actor IDs, tamper-evidence strategy.

Port: Discovery
•ObserveCluster() → ClusterState (nodes, capabilities).
•Emission cadence: on change and every N seconds (configurable).

Port: Supervisor
•Reconcile(plan) → returns ordered actions, dependencies, and readiness criteria across ports.
•Ensures serializable, idempotent execution (safe to reapply).
