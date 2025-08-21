package tenant

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
)

type memDir struct{}

func (memDir) GetTenant(ctx context.Context, id string) (Tenant, error) {
	return Tenant{ID: id, Name: "n"}, nil
}

type memMember struct{ ok bool }

func (m memMember) IsMember(ctx context.Context, tenantID, principalID string) (bool, error) {
	return m.ok, nil
}

type memResolver struct{ tenant, principal string }

func (m memResolver) Resolve(ctx context.Context, r *http.Request) (string, string, error) {
	return m.tenant, m.principal, nil
}

func TestTenantJSON(t *testing.T) {
	t1 := Tenant{ID: "t1", Name: "Acme"}
	b, err := json.Marshal(t1)
	if err != nil {
		t.Fatal(err)
	}
	var got Tenant
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != t1.ID || got.Name != t1.Name {
		t.Fatalf("roundtrip failed: %#v", got)
	}
}

func TestPortsCompile(t *testing.T) {
	var d TenantDirectoryPort = memDir{}
	var m MembershipPort = memMember{ok: true}
	var r TenantContextResolverPort = memResolver{tenant: "t1", principal: "p1"}
	if _, err := d.GetTenant(context.Background(), "t1"); err != nil {
		t.Fatal(err)
	}
	if ok, _ := m.IsMember(context.Background(), "t1", "p1"); !ok {
		t.Fatal("membership expected")
	}
	if _, _, err := r.Resolve(context.Background(), &http.Request{}); err != nil {
		t.Fatal(err)
	}
}
