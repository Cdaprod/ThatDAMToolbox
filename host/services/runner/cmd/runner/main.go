package main

// runner registers with supervisor, fetches plan and profile, and applies drift.
// Example:
//   SUPERVISOR_URL=http://localhost:8070 RUNNER_EXECUTOR=noop go run ./host/services/runner/cmd/runner

import (
	"context"
	"crypto/sha256"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/runner/internal/executor"
	"github.com/Cdaprod/ThatDamToolbox/host/services/runner/internal/model"
	"github.com/Cdaprod/ThatDamToolbox/host/services/runner/internal/state"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor"
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
	plan, prof, err := fetchDesired(ctx, nodeID)
	if err != nil {
		logx.L.Warn("desired fetch failed", "err", err)
		return false
	}
	app := model.CreateApp(nodeID, plan, prof)
	h := hash(app)
	prev, _ := st.LoadGeneration(nodeID)
	if prev == h {
		logx.L.Debug("no drift", "node", nodeID, "gen", h)
		return true
	}
	if err := exec.Apply(ctx, app); err != nil {
		logx.L.Error("apply failed", "err", err)
		return false
	}
	if err := st.SaveGeneration(nodeID, h); err != nil {
		logx.L.Warn("save gen", "err", err)
	}
	logx.L.Info("applied", "node", nodeID, "gen", h)
	return true
}

func fetchDesired(ctx context.Context, nodeID string) (model.Plan, model.Profile, error) {
	// TODO: implement HTTP calls via supervisor client
	return model.Plan{}, model.Profile{}, nil
}

func hash(app model.App) string {
	b, _ := json.Marshal(app)
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
