•Secret Hygiene: one-time tokens for bootstrap; periodic rotation; redaction in logs by default.
•Network: management surfaces not exposed outside dev; mutual TLS options for inter-service calls at prod.
•RBAC: tenancy daemon runs with least privilege for both storage & queue admin surfaces; forbid wildcard destructive operations.
•Tamper Evidence: rolling HMAC chain seeded at tenant creation; periodic anchor to independent store.
