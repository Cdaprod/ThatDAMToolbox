package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestHealthAndSession ensures basic endpoints respond.
func TestHealthAndSession(t *testing.T) {
	mux := buildMux(Config{CookieDomain: "localhost"})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	if resp, err := http.Get(srv.URL + "/health"); err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("health: %v status=%d", err, resp.StatusCode)
	}

	if resp, err := http.Get(srv.URL + "/session/me"); err != nil || resp.StatusCode != http.StatusOK {
		t.Fatalf("session: %v status=%d", err, resp.StatusCode)
	}
}
