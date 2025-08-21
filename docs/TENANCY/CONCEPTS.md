Tenant: isolation boundary for authn/z, storage, and messaging.
Cell: per-tenant services bundle providing storage + queue + audit within a well-bounded blast radius.
Profile: runtime stance that gates durability features and strictness (“dev”, “edge”, “prod”).
ClusterState: observed capacity inputs (e.g., node count, capabilities, latency class).
AchievementLevel: normalized tiers derived from ClusterState.

Achievement Levels (deterministic):
•Level 1 — Solo: Nodes ≤ 1
•Level 2 — Party: Nodes == 2
•Level 3 — Guild: Nodes == 3
•Level 4 — Realm: Nodes ≥ 4
