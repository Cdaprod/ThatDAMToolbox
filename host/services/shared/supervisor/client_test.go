package supervisor

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor/plan"
)

func TestNoop(t *testing.T) {
	os.Unsetenv("SUPERVISOR_URL")
	if err := Register(context.Background(), Agent{ID: "x"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := Heartbeat(context.Background(), "x"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestFetchPlan(t *testing.T) {
	os.Unsetenv("SUPERVISOR_URL")
	if dp, err := FetchPlan(context.Background(), map[string]string{"node_id": "n1"}); err != nil || dp.Node != "" {
		t.Fatalf("expected zero plan, got %#v err %v", dp, err)
	}

	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/v1/nodes/plan" { // FetchPlan appends /plan to base URL
			t.Fatalf("unexpected path %s", r.URL.Path)
		}
		var req map[string]string
		json.NewDecoder(r.Body).Decode(&req)
		if req["node_id"] != "n1" {
			t.Fatalf("unexpected body %v", req)
		}
		json.NewEncoder(w).Encode(plan.DesiredPlan{Version: 1, Node: "n1"})
	}))
	defer ts.Close()
	os.Setenv("SUPERVISOR_URL", ts.URL+"/v1/nodes")
	t.Cleanup(func() { os.Unsetenv("SUPERVISOR_URL") })
	dp, err := FetchPlan(context.Background(), map[string]string{"node_id": "n1"})
	if err != nil || dp.Node != "n1" {
		t.Fatalf("fetch plan failed: %v %#v", err, dp)
	}
}
