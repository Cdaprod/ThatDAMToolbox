package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	envpolicy "github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/policy/envpolicy"
	"github.com/Cdaprod/ThatDamToolbox/host/shared/tenant"
)

// TestTenancyPlanPolicy checks policy enforcement and plan output.
func TestTenancyPlanPolicy(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/tenancy/plan", nil)

	policy = envpolicy.EnvPolicy{RequireAuthForPlan: true}
	tenancyPlan(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	policy = envpolicy.EnvPolicy{AllowAnonymousProxy: true}
	req = httptest.NewRequest(http.MethodPost, "/v1/tenancy/plan", strings.NewReader(`{"profile":"prod","cluster":{"nodes":3}}`))
	tenancyPlan(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var p tenant.Plan
	if err := json.NewDecoder(rr.Body).Decode(&p); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if p.Achievement.Code != tenant.Guild {
		t.Fatalf("expected Guild, got %s", p.Achievement.Code)
	}
	if !p.Achievement.Capabilities.QuorumQueues {
		t.Fatalf("expected quorum capability")
	}
}
