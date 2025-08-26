package tenancy

// Package tenancy provides in-memory tenant and membership management.
//
// Example usage:
//     svc := NewService(RolePolicy{})
//     _ = svc.Login("user1")

import (
    "errors"
    "sync"

    hosttenant "github.com/Cdaprod/ThatDamToolbox/host/shared/tenant"
    "github.com/google/uuid"
)

// Role defines membership permissions.
type Role string

const (
    RoleViewer Role = "VIEWER"
    RoleMember Role = "MEMBER"
    RoleAdmin  Role = "ADMIN"
    RoleOwner  Role = "OWNER"
)

var roleOrder = map[Role]int{
    RoleViewer: 0,
    RoleMember: 1,
    RoleAdmin:  2,
    RoleOwner:  3,
}

// PolicyPort defines role comparison logic.
type PolicyPort interface {
    Allow(actor, target Role) bool
}

// RolePolicy provides simple role comparison.
type RolePolicy struct{}

// Allow returns true when actor >= target in the role hierarchy.
func (RolePolicy) Allow(actor, target Role) bool {
    return roleOrder[actor] >= roleOrder[target]
}

// Tenant represents a tenant account.
type Tenant struct {
    ID   uuid.UUID     `json:"id"`
    Name string        `json:"name"`
    Plan hosttenant.Plan `json:"plan"`
}

// Membership ties a user to a tenant with a role.
type Membership struct {
    ID       uuid.UUID `json:"id"`
    TenantID uuid.UUID `json:"tenant_id"`
    UserID   string    `json:"user_id"`
    Role     Role      `json:"role"`
}

// Service implements in-memory tenancy logic.
type Service struct {
    mu          sync.Mutex
    policy      PolicyPort
    tenants     map[uuid.UUID]Tenant
    memberships map[uuid.UUID]Membership
}

// NewService constructs a Service with the provided policy.
func NewService(p PolicyPort) *Service {
    return &Service{
        policy:      p,
        tenants:     make(map[uuid.UUID]Tenant),
        memberships: make(map[uuid.UUID]Membership),
    }
}

// Reset clears all tenants and memberships.
func (s *Service) Reset() {
    s.mu.Lock()
    defer s.mu.Unlock()
    s.tenants = make(map[uuid.UUID]Tenant)
    s.memberships = make(map[uuid.UUID]Membership)
}

// Login returns an existing membership for the user or creates a new tenant.
func (s *Service) Login(userID string) Membership {
    s.mu.Lock()
    defer s.mu.Unlock()
    for _, m := range s.memberships {
        if m.UserID == userID {
            return m
        }
    }
    tenant := Tenant{ID: uuid.New(), Name: userID + "'s tenant", Plan: hosttenant.PlanFor(hosttenant.ProfileDev, hosttenant.ClusterState{Nodes:1})}
    s.tenants[tenant.ID] = tenant
    membership := Membership{ID: uuid.New(), TenantID: tenant.ID, UserID: userID, Role: RoleOwner}
    s.memberships[membership.ID] = membership
    return membership
}

// CreateTenant creates a tenant owned by userID.
func (s *Service) CreateTenant(name, userID string) Tenant {
    s.mu.Lock()
    defer s.mu.Unlock()
    tenant := Tenant{ID: uuid.New(), Name: name, Plan: hosttenant.PlanFor(hosttenant.ProfileDev, hosttenant.ClusterState{Nodes:1})}
    s.tenants[tenant.ID] = tenant
    membership := Membership{ID: uuid.New(), TenantID: tenant.ID, UserID: userID, Role: RoleOwner}
    s.memberships[membership.ID] = membership
    return tenant
}

func (s *Service) actorMembership(userID string, tenantID uuid.UUID) (Membership, error) {
    for _, m := range s.memberships {
        if m.UserID == userID && m.TenantID == tenantID {
            return m, nil
        }
    }
    return Membership{}, errors.New("membership required")
}

// Invite adds targetUser to the tenant with a role if actor is allowed.
func (s *Service) Invite(tenantID uuid.UUID, actorUser, targetUser string, role Role) (Membership, error) {
    s.mu.Lock()
    defer s.mu.Unlock()
    actor, err := s.actorMembership(actorUser, tenantID)
    if err != nil {
        return Membership{}, err
    }
    if !s.policy.Allow(actor.Role, role) {
        return Membership{}, errors.New("insufficient role")
    }
    membership := Membership{ID: uuid.New(), TenantID: tenantID, UserID: targetUser, Role: role}
    s.memberships[membership.ID] = membership
    return membership, nil
}

// UpdateMembership updates a membership role if actor has higher privilege.
func (s *Service) UpdateMembership(membershipID uuid.UUID, actorUser string, role Role) (Membership, error) {
    s.mu.Lock()
    defer s.mu.Unlock()
    membership, ok := s.memberships[membershipID]
    if !ok {
        return Membership{}, errors.New("membership not found")
    }
    actor, err := s.actorMembership(actorUser, membership.TenantID)
    if err != nil {
        return Membership{}, err
    }
    if !s.policy.Allow(actor.Role, role) || roleOrder[actor.Role] <= roleOrder[membership.Role] {
        return Membership{}, errors.New("insufficient role")
    }
    membership.Role = role
    s.memberships[membership.ID] = membership
    return membership, nil
}

// Health returns a simple status map.
func (s *Service) Health() map[string]string {
    return map[string]string{"status": "ok"}
}

