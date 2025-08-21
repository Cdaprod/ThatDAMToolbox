package tenant

import "context"

// StoragePort ensures storage readiness per tenant.
type StoragePort interface {
	EnsureTenant(ctx context.Context, t Tenant, cfg StoragePlan) error
	Validate(ctx context.Context, t Tenant) error
}

// QueuePort ensures queue topology per tenant.
type QueuePort interface {
	EnsureTenant(ctx context.Context, t Tenant, cfg QueuePlan) error
	Validate(ctx context.Context, t Tenant) error
}

// AuditPort emits signed audit events.
type AuditPort interface {
	Emit(ctx context.Context, e Event) error
}

// DiscoveryPort observes cluster state for planning.
type DiscoveryPort interface {
	ObserveCluster(ctx context.Context) (ClusterState, error)
}

// SupervisorPort reconciles plans across ports.
type SupervisorPort interface {
	Reconcile(ctx context.Context, plan Plan) error
}

// Event is the audit envelope (schema v1).
type Event struct {
	TenantID  string            `json:"tenant_id"`
	EventType string            `json:"event_type"`
	TSUTC     string            `json:"ts_utc_rfc3339"`
	RequestID string            `json:"request_id"`
	ActorID   string            `json:"actor_id"`
	DeviceID  string            `json:"device_id"`
	IP        string            `json:"ip"`
	UserAgent string            `json:"user_agent"`
	Context   map[string]string `json:"context"`
	Integrity Integrity         `json:"integrity"`
}

// Integrity links events with an HMAC chain.
type Integrity struct {
	ChainID string `json:"chain_id"`
	Hash    string `json:"hash"`
}
