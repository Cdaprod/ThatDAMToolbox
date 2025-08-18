package plan

import (
	"encoding/json"
	"reflect"
	"testing"
)

// TestRoundTrip ensures DesiredPlan marshals and unmarshals without loss.
func TestRoundTrip(t *testing.T) {
	orig := DesiredPlan{
		Version:  1,
		Node:     "n1",
		Executor: "exec",
		Apps: []AppSpec{{
			Name: "app", Kind: "go", Cwd: "/srv", Command: []string{"/srv/app"},
			Env:   map[string]string{"PORT": "8080"},
			Ports: []int{8080},
			After: []string{"db"}, Restart: "always",
			Health: &HealthCheck{HTTP: "http://localhost:8080/health", IntervalSec: 5, TimeoutSec: 30},
			Build:  &BuildSpec{Kind: BuildNextJS, Strategy: "standalone", Command: []string{"npm", "ci"}, OutDir: ".next", Env: map[string]string{"A": "B"}},
		}},
	}

	b, err := json.Marshal(orig)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var got DesiredPlan
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if !reflect.DeepEqual(orig, got) {
		t.Fatalf("round trip mismatch: %#v != %#v", orig, got)
	}
}
