package main

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/auth-bridge/internal/config"
	"github.com/Cdaprod/ThatDamToolbox/host/services/auth-bridge/internal/server"
)

// TestEndpoints ensures basic endpoints respond.
func TestEndpoints(t *testing.T) {
	cfg := config.Load()
	mux := server.BuildMux(cfg)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	if resp, err := http.Get(srv.URL + "/health"); err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("health: %v status=%d", err, resp.StatusCode)
	}

	if resp, err := http.Get(srv.URL + "/session/me"); err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("session: %v status=%d", err, resp.StatusCode)
	}

	body := bytes.NewBufferString(`{"profile":"capture"}`)
	resp, err := http.Post(srv.URL+"/runners/register", "application/json", body)
	if err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("register: %v status=%d", err, resp.StatusCode)
	}
}
