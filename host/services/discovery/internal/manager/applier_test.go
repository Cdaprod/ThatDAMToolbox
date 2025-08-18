package manager

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"

	runtimeports "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/ports"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor/plan"
)

type mockRuntime struct {
	mu    sync.Mutex
	calls []string
}

func (m *mockRuntime) Ensure(ctx context.Context, u runtimeports.UnitSpec) error {
	m.mu.Lock()
	m.calls = append(m.calls, u.Name)
	m.mu.Unlock()
	return nil
}
func (m *mockRuntime) Stop(ctx context.Context, name string) error { return nil }
func (m *mockRuntime) State(ctx context.Context, name string) (runtimeports.UnitState, error) {
	return runtimeports.UnitState{Name: name, Active: true}, nil
}

func TestApplier(t *testing.T) {
	logx.Init(logx.Config{})
	tmp := t.TempDir()
	buildLog := filepath.Join(tmp, "build.log")
	// stub npm
	npm := filepath.Join(tmp, "npm")
	if err := os.WriteFile(npm, []byte("#!/bin/sh\necho build >>"+buildLog+"\n"), 0o755); err != nil {
		t.Fatalf("write npm: %v", err)
	}
	// stub node for LookPath
	node := filepath.Join(tmp, "node")
	if err := os.WriteFile(node, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatalf("write node: %v", err)
	}
	origPath := os.Getenv("PATH")
	os.Setenv("PATH", tmp+":"+origPath)
	t.Cleanup(func() { os.Setenv("PATH", origPath) })

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(200)
	}))
	defer srv.Close()

	dp := plan.DesiredPlan{Apps: []plan.AppSpec{
		{
			Name: "one", Kind: "nextjs", Cwd: tmp, Command: []string{"echo"},
			Build:  &plan.BuildSpec{Kind: plan.BuildNextJS},
			Health: &plan.HealthCheck{HTTP: srv.URL, IntervalSec: 1, TimeoutSec: 5},
		},
		{Name: "two", Kind: "go", Command: []string{"echo"}, After: []string{"one"}},
	}}

	mr := &mockRuntime{}
	a := Applier{rt: mr}
	if err := a.Apply(context.Background(), dp); err != nil {
		t.Fatalf("apply: %v", err)
	}
	if len(mr.calls) != 2 || mr.calls[0] != "one" || mr.calls[1] != "two" {
		t.Fatalf("unexpected call order: %v", mr.calls)
	}
	if _, err := os.Stat(buildLog); err != nil {
		t.Fatalf("build log not created: %v", err)
	}
}
