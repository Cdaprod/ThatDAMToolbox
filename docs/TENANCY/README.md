Purpose: Define the domain model and ports for tenancy independent of runtime (Docker, systemd, k8s). This layer contains pure logic and contracts only—no vendor SDKs, no container assumptions.

Scope
•Concepts: Tenant, Cell, Profile (dev/edge/prod), ClusterState, AchievementLevel.
•Planning: f(Profile, ClusterState) → Plan.
•Contracts: “ports” that concrete runtimes/adapters must satisfy (storage, queue, audit, discovery, supervisor).
•Events & telemetry envelopes.
•Policy: default security, durability, and audit expectations.
•Versioning of plan schemas and event contracts.

Non-Goals
•No SDK calls (MinIO/RabbitMQ, etc.).
•No Docker/k8s specifics.
•No command invocations or shell snippets.
