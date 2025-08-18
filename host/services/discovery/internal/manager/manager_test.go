package manager

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor/plan"
)

func TestStartServerModeUsesPlan(t *testing.T) {
	dm := New()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/nodes/plan" {
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		var req map[string]string
		json.NewDecoder(r.Body).Decode(&req)
		if req["role_hint"] != "server" {
			t.Fatalf("expected server role, got %v", req)
		}
		json.NewEncoder(w).Encode(plan.DesiredPlan{Version: 1, Node: req["node_id"]})
	}))
	defer ts.Close()
	os.Setenv("SUPERVISOR_URL", ts.URL+"/v1/nodes")
	defer os.Unsetenv("SUPERVISOR_URL")
	if err := dm.startServerMode(); err != nil {
		t.Fatalf("startServerMode: %v", err)
	}
}

func TestStartProxyModeUsesPlan(t *testing.T) {
	dm := New()
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(plan.DesiredPlan{Version: 1})
	}))
	defer ts.Close()
	os.Setenv("SUPERVISOR_URL", ts.URL+"/v1/nodes")
	defer os.Unsetenv("SUPERVISOR_URL")
	if err := dm.startProxyMode(); err != nil {
		t.Fatalf("startProxyMode: %v", err)
	}
}
