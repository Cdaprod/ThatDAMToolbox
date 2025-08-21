Envelope (v1)
•tenant_id, event_type, ts_utc_rfc3339, request_id, actor_id, device_id, ip, user_agent
•context: freeform kv for port-specific fields.
•integrity: rolling HMAC chain id + hash.

Audit Categories
•storage.bucket.created | policy.applied | versioning.enabled | audit.webhook.registered
•queue.exchange.declared | queue.queue.declared | queue.binding.created | queue.mode.quorum.enabled
•reconcile.plan.applied | reconcile.validation.failed | reconcile.downgrade.blocked
