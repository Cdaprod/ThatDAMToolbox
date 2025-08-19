package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/runner/internal/executor"
	"github.com/Cdaprod/ThatDamToolbox/host/services/runner/internal/state"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	"github.com/Cdaprod/ThatDamToolbox/host/shared/platform"
)

// TestClaimTokenTriggersFulfill ensures claim fulfillment happens before plan fetch.
func TestClaimTokenTriggersFulfill(t *testing.T) {
	logx.Init(logx.Config{Service: "test"})
	calls := []string{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/claims/fulfill":
			calls = append(calls, "claim")
			w.WriteHeader(http.StatusNoContent)
		case "/plan":
			calls = append(calls, "plan")
			w.Header().Set("Content-Type", "application/json")
			json.NewEncoder(w).Encode(map[string]any{"apps": []any{}})
		default:
			w.WriteHeader(http.StatusNotFound)
		}
	}))
	defer srv.Close()
	os.Setenv("SUPERVISOR_URL", srv.URL)
	defer os.Unsetenv("SUPERVISOR_URL")

	st := state.NewDiskStore(t.TempDir(), platform.NewOSDirEnsurer())
	exec := executor.New("noop")

	if !applyOnce(context.Background(), "n1", exec, st, "tok", "", "") {
		t.Fatal("applyOnce returned false")
	}
	if len(calls) != 2 || calls[0] != "claim" || calls[1] != "plan" {
		t.Fatalf("unexpected call order %v", calls)
	}
}
