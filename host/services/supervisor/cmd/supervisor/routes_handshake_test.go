package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor/plan"
	envpolicy "github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/policy/envpolicy"
)

func TestNodesRegisterPolicy(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/nodes/register", nil)

	policy = envpolicy.EnvPolicy{RequireAuthForPlan: true}
	nodesRegister(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	policy = envpolicy.EnvPolicy{AllowAnonymousProxy: true}
	nodesRegister(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}

// TestNodesPlanPolicy ensures policy enforcement and response structure.
func TestNodesPlanPolicy(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/nodes/plan", nil)

	policy = envpolicy.EnvPolicy{RequireAuthForPlan: true}
	nodesPlan(rr, req)
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d", rr.Code)
	}

	rr = httptest.NewRecorder()
	policy = envpolicy.EnvPolicy{AllowAnonymousProxy: true}
	req = httptest.NewRequest(http.MethodPost, "/v1/nodes/plan", strings.NewReader(`{"node_id":"n1","role_hint":"server"}`))
	nodesPlan(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var dp plan.DesiredPlan
	if err := json.NewDecoder(rr.Body).Decode(&dp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if dp.Node != "n1" || len(dp.Apps) == 0 {
		t.Fatalf("unexpected plan: %#v", dp)
	}
}
