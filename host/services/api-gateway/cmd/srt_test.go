package main

import (
	"encoding/json"
	"net/http/httptest"
	"testing"
)

// TestRegistryHandler returns negotiated SRT URL.
func TestRegistryHandler(t *testing.T) {
	t.Setenv("SRT_BASE_URL", "srt://localhost:9000")
	req := httptest.NewRequest("GET", "/api/registry/srt?device=cam1", nil)
	rr := httptest.NewRecorder()
	registryHandler(rr, req)
	if rr.Code != 200 {
		t.Fatalf("status %d", rr.Code)
	}
	var out map[string]string
	if err := json.NewDecoder(rr.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out["uri"] != "srt://localhost:9000?streamid=cam1" {
		t.Fatalf("unexpected uri: %s", out["uri"])
	}
}
