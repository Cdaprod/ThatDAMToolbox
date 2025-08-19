package main

// runner registers with supervisor, fetches a DesiredPlan, orders apps by
// dependencies, and applies them via the selected executor.
// Example:
//   SUPERVISOR_URL=http://localhost:8070 RUNNER_EXECUTOR=docker \
//     go run ./host/services/runner/cmd/runner

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/runner/internal/executor"
	"github.com/Cdaprod/ThatDamToolbox/host/services/runner/internal/state"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor/plan"
	"github.com/Cdaprod/ThatDamToolbox/host/shared/platform"
)

var version = "dev"

func main() {
	logx.Init(logx.Config{Service: "runner", Version: version})
	ctx := context.Background()
	nodeID := getenv("RUNNER_NODE_ID", hostname())
	execKind := getenv("RUNNER_EXECUTOR", "docker")
	exec := executor.New(execKind)
	store := state.NewDiskStore(getenv("RUNNER_STATE_DIR", "/var/lib/thatdam/runner"), platform.NewOSDirEnsurer())

	_ = supervisor.Register(ctx, supervisor.Agent{ID: nodeID, Class: "runner", Version: version})

	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()
	claimToken := os.Getenv("CLAIM_TOKEN")
	roleHint := os.Getenv("ROLE_HINT")
	labels := os.Getenv("LABELS")
	for {
		if applyOnce(ctx, nodeID, exec, store, claimToken, roleHint, labels) {
			_ = supervisor.Heartbeat(ctx, nodeID)
		}
		<-ticker.C
	}
}

func applyOnce(ctx context.Context, nodeID string, exec executor.Executor, st state.Store, claimToken, roleHint, labels string) bool {
	caps := capabilities()
	prev, err := st.LoadGeneration(nodeID)
	firstBoot := err != nil || prev == ""
	if firstBoot && claimToken != "" {
		if err := fulfillClaim(ctx, claimToken, nodeID, caps); err != nil {
			logx.L.Warn("claim fulfill", "err", err)
		}
	}
	dp, err := fetchDesired(ctx, nodeID, roleHint, labels, caps)
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

func fetchDesired(ctx context.Context, nodeID, roleHint, labels string, caps capabilityInfo) (plan.DesiredPlan, error) {
	req := map[string]any{"node_id": nodeID}
	if roleHint != "" {
		req["role_hint"] = roleHint
	}
	if labels != "" {
		req["labels"] = labels
	}
	req["capabilities"] = caps
	return supervisor.FetchPlan(ctx, req)
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

// capabilityInfo describes local hardware hints sent to supervisor or claims.
type capabilityInfo struct {
	VideoDevices []string `json:"video_devices,omitempty"`
	GPU          []string `json:"gpu,omitempty"`
}

// capabilities enumerates /dev/video* and basic GPU hints.
// Example:
//
//	info := capabilities()
//	fmt.Println(info.VideoDevices)
func capabilities() capabilityInfo {
	vids, _ := filepath.Glob("/dev/video*")
	gpus := []string{}
	filepath.WalkDir("/dev", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return nil
		}
		if strings.HasPrefix(filepath.Base(p), "nvidia") || strings.HasPrefix(filepath.Base(p), "dri") {
			gpus = append(gpus, p)
		}
		return nil
	})
	return capabilityInfo{VideoDevices: vids, GPU: gpus}
}

// fulfillClaim posts a claim token for node to the supervisor if configured.
// Example:
//
//	_ = fulfillClaim(ctx, "token", "node1", capabilities())
func fulfillClaim(ctx context.Context, token, nodeID string, info capabilityInfo) error {
	baseURL := os.Getenv("SUPERVISOR_URL")
	if baseURL == "" {
		return nil
	}
	payload := map[string]any{"token": token, "node_id": nodeID, "info": info}
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/api/claims/fulfill", bytes.NewReader(b))
	if err != nil {
		return err
	}
	if t := os.Getenv("SUPERVISOR_TOKEN"); t != "" {
		req.Header.Set("Authorization", "Bearer "+t)
	} else if k := os.Getenv("SUPERVISOR_API_KEY"); k != "" {
		req.Header.Set("X-API-Key", k)
	}
	req.Header.Set("Content-Type", "application/json")
	hc := &http.Client{Timeout: 5 * time.Second}
	resp, err := hc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		io.CopyN(io.Discard, resp.Body, 1024)
		return fmt.Errorf("claim fulfill: %s", resp.Status)
	}
	return nil
}
