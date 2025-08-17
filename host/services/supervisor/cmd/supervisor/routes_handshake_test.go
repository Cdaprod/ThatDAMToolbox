package main

import (
	"net/http"
	"net/http/httptest"
	"testing"

	envpolicy "github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/policy/envpolicy"
)

func TestNodesRegisterPolicy(t *testing.T) {
	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/v1/nodes/register", nil)

	policy = envpolicy.EnvPolicy{AllowAnonymousProxy: false}
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
