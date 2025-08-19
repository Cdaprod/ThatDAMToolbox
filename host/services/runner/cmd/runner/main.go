package main

// runner registers with supervisor, fetches a DesiredPlan, orders apps by
// dependencies, and applies them via the selected executor.
// Example:
//   SUPERVISOR_URL=http://localhost:8070 RUNNER_EXECUTOR=docker \
//     go run ./host/services/runner/cmd/runner

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/runner/internal/executor"
	"github.com/Cdaprod/ThatDamToolbox/host/services/runner/internal/state"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor/plan"
)

var version = "dev"

func main() {
	logx.Init(logx.Config{Service: "runner", Version: version})
	ctx := context.Background()
	nodeID := getenv("RUNNER_NODE_ID", hostname())
	execKind := getenv("RUNNER_EXECUTOR", "docker")
	exec := executor.New(execKind)
	store := state.NewDiskStore(getenv("RUNNER_STATE_DIR", "/var/lib/thatdam/runner"))

	_ = supervisor.Register(ctx, supervisor.Agent{ID: nodeID, Class: "runner", Version: version})

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	for {
		if applyOnce(ctx, nodeID, exec, store) {
			_ = supervisor.Heartbeat(ctx, nodeID)
		}
		<-ticker.C
	}
}

func applyOnce(ctx context.Context, nodeID string, exec executor.Executor, st state.Store) bool {
	dp, err := fetchDesired(ctx, nodeID)
	if err != nil {
		logx.L.Warn("desired fetch failed", "err", err)
		return false
	}
	ordered, err := orderApps(dp.Apps)
	if err != nil {
		logx.L.Warn("order apps", "err", err)
		return false
	}
	dp.Apps = ordered
	h := hash(dp)
	prev, _ := st.LoadGeneration(nodeID)
	if prev == h {
		logx.L.Debug("no drift", "node", nodeID, "gen", h)
		return true
	}
	if err := exec.Apply(ctx, dp); err != nil {
		logx.L.Error("apply failed", "err", err)
		return false
	}
	if err := st.SaveGeneration(nodeID, h); err != nil {
		logx.L.Warn("save gen", "err", err)
	}
	logx.L.Info("applied", "node", nodeID, "gen", h)
	return true
}

func fetchDesired(ctx context.Context, nodeID string) (plan.DesiredPlan, error) {
	return supervisor.FetchPlan(ctx, map[string]string{"node_id": nodeID})
}

func hash(dp plan.DesiredPlan) string {
	b, _ := json.Marshal(dp)
	sum := sha256.Sum256(b)
	return fmt.Sprintf("%x", sum[:])
}

func getenv(k, def string) string {
	if v := os.Getenv(k); v != "" {
		return v
	}
	return def
}
func hostname() string {
	h, _ := os.Hostname()
	if h == "" {
		return "unknown"
	}
	return h
}

func orderApps(apps []plan.AppSpec) ([]plan.AppSpec, error) {
	indegree := map[string]int{}
	graph := map[string][]string{}
	lookup := map[string]plan.AppSpec{}
	for _, a := range apps {
		lookup[a.Name] = a
		for _, dep := range a.After {
			indegree[a.Name]++
			graph[dep] = append(graph[dep], a.Name)
		}
	}
	queue := []string{}
	for _, a := range apps {
		if indegree[a.Name] == 0 {
			queue = append(queue, a.Name)
		}
	}
	var ordered []plan.AppSpec
	for len(queue) > 0 {
		n := queue[0]
		queue = queue[1:]
		ordered = append(ordered, lookup[n])
		for _, m := range graph[n] {
			indegree[m]--
			if indegree[m] == 0 {
				queue = append(queue, m)
			}
		}
	}
	if len(ordered) != len(apps) {
		return nil, errors.New("dependency cycle detected")
	}
	return ordered, nil
}
