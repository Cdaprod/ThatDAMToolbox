package main

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	envpolicy "github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/policy/envpolicy"
)

// TestNodesList verifies that GET /v1/nodes returns the registry snapshot.
func TestNodesList(t *testing.T) {
	policy = envpolicy.EnvPolicy{AllowAnonymousProxy: true}
	reg = NewRegistry()
	reg.Upsert(Agent{ID: "n1", Status: "healthy"})

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/nodes", nil)
	nodesList(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var out []Agent
	if err := json.NewDecoder(rr.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if len(out) != 1 || out[0].ID != "n1" {
		t.Fatalf("unexpected: %#v", out)
	}
}

// TestNodesListNoAPIKey ensures listing works when an API key is configured but not provided.
func TestNodesListNoAPIKey(t *testing.T) {
	policy = envpolicy.EnvPolicy{}
	reg = NewRegistry()
	apiKey = "secret"
	t.Cleanup(func() { apiKey = "" })

	rr := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/v1/nodes", nil)
	nodesList(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}
