Security Defaults
•Deny-by-default policies on storage; least privilege per tenant.
•Queue permissions confined to tenant namespace.
•TLS required except dev; minimum cipher suite defined in runtime.
•Secrets lifecycle: rotation period, one-time bootstrap tokens, never log secrets.

Durability
•Storage: versioning on; erasure coding recommended at Party+ (subject to adapter capability).
•Queue: quorum queues at Guild+; DLX per tenant always.

Compliance
•Optional WORM/object-lock per tenant flag (plan.ext).
•Retention tiers: hot 7–30d, warm 90–180d, cold indefinite per policy.
