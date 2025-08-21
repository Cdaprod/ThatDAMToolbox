package tenant

import (
	"context"
	"net/http"
)

// Tenant represents a minimal tenant record.
type Tenant struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// TenantDirectoryPort provides tenant lookup capabilities.
type TenantDirectoryPort interface {
	// GetTenant returns a tenant by id or error if not found.
	GetTenant(ctx context.Context, id string) (Tenant, error)
}

// MembershipPort checks principal membership in a tenant.
type MembershipPort interface {
	// IsMember reports whether principalID belongs to tenantID.
	IsMember(ctx context.Context, tenantID, principalID string) (bool, error)
}

// TenantContextResolverPort resolves tenant and principal from a request.
type TenantContextResolverPort interface {
	// Resolve extracts tenant and principal identifiers from r.
	Resolve(ctx context.Context, r *http.Request) (tenantID, principalID string, err error)
}
