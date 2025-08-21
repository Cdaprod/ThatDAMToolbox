A Plan is “Ready” when:
•Storage: bucket exists, versioning verified, policy applied, audit webhook responsive (200) with signed check.
•Queue: exchanges/queues declared, quorum status verified (if enabled), DLX bound, trace event observed.
•Audit: at least one signed event stored and retrievable by hash chain reference.
•Time-boxed: fail fast with actionable reasons; retry backoff policy defined by runtime.
