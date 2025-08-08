package main

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestAuthMiddleware ensures requests require the bearer token when configured.
func TestAuthMiddleware(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/devices", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := authMiddleware("secret", nil, mux)
	srv := httptest.NewServer(handler)
	defer srv.Close()

	// Unauthorized request should be rejected
	resp, err := http.Get(srv.URL + "/devices")
	if err != nil {
		t.Fatalf("http get: %v", err)
	}
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("expected 401, got %d", resp.StatusCode)
	}

	// Authorized request succeeds
	req, _ := http.NewRequest("GET", srv.URL+"/devices", nil)
	req.Header.Set("Authorization", "Bearer secret")
	resp, err = http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("authorized request: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}
