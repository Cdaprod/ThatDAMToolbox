UX Mapping (stable labels & descriptions surfaced to UI)
•Solo (Level 1): “Single-node development mode.”
•Party (Level 2): “Distributed storage unlocked; limited HA queues.”
•Guild (Level 3): “Consensus achieved; production-grade queues.”
•Realm (Level 4): “High availability at scale; multi-pool storage.”

Expose as:
•achievement.code (Solo|Party|Guild|Realm)
•achievement.title (stable string)
•achievement.capabilities (array of booleans: distributed_storage, quorum_queues, tls_enforced, audit_streaming)
