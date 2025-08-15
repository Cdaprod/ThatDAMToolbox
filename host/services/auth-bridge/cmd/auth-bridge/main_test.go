package main

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
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

// TestRunnerRegister verifies that the registration endpoint returns a script
// and logs the request.
func TestRunnerRegister(t *testing.T) {
	runnerStore = &memoryStore{}
	mux := buildMux(Config{CookieDomain: "localhost"})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	body := strings.NewReader(`{"profile":"demo"}`)
	resp, err := http.Post(srv.URL+"/runners/register", "application/json", body)
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status=%d", resp.StatusCode)
	}
	data, _ := io.ReadAll(resp.Body)
	if !bytes.Contains(data, []byte("TOKEN=")) {
		t.Fatalf("script missing token: %s", data)
	}
	if ms, ok := runnerStore.(*memoryStore); !ok || len(ms.logs) != 1 {
		t.Fatalf("registration not logged")
	}
}
