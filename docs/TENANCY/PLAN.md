Planner: Deterministic function producing a Plan from Profile + ClusterState.

Plan (schema v1):
•profile: dev|edge|prod
•achievement: Solo|Party|Guild|Realm
•storage:
•mode: fs|distributed
•servers: integer ≥1 (logical placement groups)
•volumes_per_server: integer ≥1
•versioning: bool (expected on by default)
•require_tls: bool (true unless dev)
•enable_audit_hook: bool (always true)
•queue:
•replicas: integer ≥1
•quorum_queues: bool (true at Guild+ only)
•require_tls: bool (true unless dev)
•dlx_per_tenant: bool (true)
•tracing_to_audit_exchange: bool (true)

Mapping (reference)
•Solo → storage(fs, 1×1), queue(replicas=1, quorum=false)
•Party → storage(distributed, 2×2), queue(replicas=2, quorum=false; flagged “reduced HA”)
•Guild → storage(distributed, 3×2), queue(replicas=3, quorum=true)
•Realm → storage(distributed, ≥4×2), queue(replicas=3, quorum=true)

Invariants
•No quorum unless replicas ≥3.
•TLS required outside dev.
•Audit enabled in all profiles (sink may differ).
