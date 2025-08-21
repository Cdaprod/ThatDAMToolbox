package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/auth-bridge/internal/config"
	"github.com/Cdaprod/ThatDamToolbox/host/services/auth-bridge/internal/server"
)

// TestEndpoints ensures basic endpoints respond.
func TestEndpoints(t *testing.T) {
	tenancy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"m1","tenant_id":"t1","user_id":"demo","role":"OWNER"}`))
	}))
	defer tenancy.Close()
	os.Setenv("TENANCY_URL", tenancy.URL)
	defer os.Unsetenv("TENANCY_URL")

	cfg := config.Load()
	mux := server.BuildMux(cfg)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	if resp, err := http.Get(srv.URL + "/health"); err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("health: %v status=%d", err, resp.StatusCode)
	}

	if resp, err := http.Get(srv.URL + "/session/me"); err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("session: %v status=%d", err, resp.StatusCode)
	} else {
		var payload map[string]any
		if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
			t.Fatalf("decode: %v", err)
		}
		if _, ok := payload["membership"]; !ok {
			t.Fatalf("expected membership in response")
		}
	}

	body := bytes.NewBufferString(`{"profile":"capture"}`)
	resp, err := http.Post(srv.URL+"/runners/register", "application/json", body)
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("register: %v status=%d", err, resp.StatusCode)
	}
}
