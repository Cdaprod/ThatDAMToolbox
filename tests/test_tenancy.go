package tests

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    tenancy "github.com/Cdaprod/ThatDamToolbox/host/services/tenancy"
)

type membership struct {
    ID       string `json:"id"`
    TenantID string `json:"tenant_id"`
    Role     string `json:"role"`
}

type tenant struct {
    ID   string `json:"id"`
    Name string `json:"name"`
}

func TestTenancyFlow(t *testing.T) {
    svc := tenancy.NewService(tenancy.RolePolicy{})
    server := httptest.NewServer(tenancy.NewServer(svc))
    defer server.Close()

    client := server.Client()

    // health
    resp, err := client.Get(server.URL + "/health")
    if err != nil || resp.StatusCode != http.StatusOK {
        t.Fatalf("health failed: %v", err)
    }

    // login
    req, _ := http.NewRequest(http.MethodPost, server.URL+"/login", nil)
    req.Header.Set("X-User-ID", "user1")
    resp, err = client.Do(req)
    if err != nil {
        t.Fatalf("login request failed: %v", err)
    }
    defer resp.Body.Close()
    if resp.StatusCode != http.StatusOK {
        t.Fatalf("login status %d", resp.StatusCode)
    }
    var owner membership
    json.NewDecoder(resp.Body).Decode(&owner)
    if owner.Role != string(tenancy.RoleOwner) {
        t.Fatalf("expected owner role")
    }

    // create tenant
    body, _ := json.Marshal(map[string]string{"name": "Team"})
    req, _ = http.NewRequest(http.MethodPost, server.URL+"/tenants", bytes.NewReader(body))
    req.Header.Set("X-User-ID", "user1")
    resp, err = client.Do(req)
    if err != nil || resp.StatusCode != http.StatusOK {
        t.Fatalf("create tenant failed: %v status %d", err, resp.StatusCode)
    }
    var tnt tenant
    json.NewDecoder(resp.Body).Decode(&tnt)

    // invite
    body, _ = json.Marshal(map[string]string{"user_id": "user2", "role": string(tenancy.RoleMember)})
    req, _ = http.NewRequest(http.MethodPost, server.URL+"/tenants/"+owner.TenantID+"/invite", bytes.NewReader(body))
    req.Header.Set("X-User-ID", "user1")
    resp, err = client.Do(req)
    if err != nil || resp.StatusCode != http.StatusOK {
        t.Fatalf("invite failed: %v status %d", err, resp.StatusCode)
    }
    var member membership
    json.NewDecoder(resp.Body).Decode(&member)

    // membership update
    body, _ = json.Marshal(map[string]string{"role": string(tenancy.RoleAdmin)})
    req, _ = http.NewRequest(http.MethodPatch, server.URL+"/memberships/"+member.ID, bytes.NewReader(body))
    req.Header.Set("X-User-ID", "user1")
    resp, err = client.Do(req)
    if err != nil || resp.StatusCode != http.StatusOK {
        t.Fatalf("update failed: %v status %d", err, resp.StatusCode)
    }
    var updated membership
    json.NewDecoder(resp.Body).Decode(&updated)
    if updated.Role != string(tenancy.RoleAdmin) {
        t.Fatalf("expected role ADMIN, got %s", updated.Role)
    }

    _ = tnt // avoid unused warnings
}

