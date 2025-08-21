# Environments: dev vs edge vs prod

| Aspect         | dev (local)                                              | edge (production-lite)                                 | prod (SaaS)                                  |
|----------------|-----------------------------------------------------------|--------------------------------------------------------|----------------------------------------------|
| Audience       | You, iterative                                            | Partners / single-tenant / on-prem                     | Your public multi-tenant cloud               |
| Image ref      | `:{CHANNEL}` → `:dev`                                     | `:{VERSION}` or digest (prefer digest)                 | `:{VERSION}@sha256:…` (always digest)        |
| HA / Durability| Minimal, convenient                                       | Reduced HA allowed, TLS required                       | Full HA, TLS strict, backups/retention       |
| Backends       | Prefer local MinIO/Weaviate (fallback to cloud)           | Prefer local if provided, else cloud                   | Managed cloud endpoints                      |
| Frontend       | Dev server / local                                       | Hosted UI (calls cloud APIs)                           | Hosted UI (CDN + API)                        |
| Flags          | `dev,debug` defaults                                      | Explicit per device/site                               | Feature-gated & tenant/device canary         |

**Rule of thumb:** edge == prod behavior with lighter guarantees. Prod is your cloud; edge is the customer/site.
