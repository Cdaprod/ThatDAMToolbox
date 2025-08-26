package tenancy

import "testing"

func TestLoginCreatesTenant(t *testing.T) {
    svc := NewService(RolePolicy{})
    m := svc.Login("user1")
    if m.Role != RoleOwner {
        t.Fatalf("expected owner, got %s", m.Role)
    }
    if _, ok := svc.tenants[m.TenantID]; !ok {
        t.Fatalf("tenant not created")
    }
}

func TestInviteAndUpdate(t *testing.T) {
    svc := NewService(RolePolicy{})
    owner := svc.Login("owner")
    inv, err := svc.Invite(owner.TenantID, "owner", "user2", RoleMember)
    if err != nil {
        t.Fatalf("invite failed: %v", err)
    }
    if inv.Role != RoleMember {
        t.Fatalf("expected member role")
    }
    upd, err := svc.UpdateMembership(inv.ID, "owner", RoleAdmin)
    if err != nil {
        t.Fatalf("update failed: %v", err)
    }
    if upd.Role != RoleAdmin {
        t.Fatalf("role not updated")
    }
}

