package handshake

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
)

// clusterState represents the persisted identity and role of this node.
type clusterState struct {
	NodeID   string   `json:"node_id"`
	Role     string   `json:"role"`
	Epoch    int      `json:"epoch"`
	Services []string `json:"services,omitempty"`
}

var (
	stateMu sync.RWMutex
	state   clusterState
	client  = &http.Client{Timeout: 5 * time.Second}
)

// runHandshake registers the node, fetches the desired plan and starts heartbeats.
//
// It is safe to call multiple times; node identity is persisted to cluster.json.
func runHandshake(ctx context.Context) error {
	s, err := loadState()
	if err != nil {
		return err
	}
	stateMu.Lock()
	state = s
	if state.NodeID == "" {
		host, _ := os.Hostname()
		state.NodeID = fmt.Sprintf("%s-%d", host, time.Now().UnixNano())
	}
	stateMu.Unlock()

	url := supervisorURL()

	var regResp struct {
		NodeID string `json:"node_id"`
		TTL    int    `json:"ttl"`
	}

	// Attempt registration with simple retries.
	for i := 0; i < 3; i++ {
		if err := postJSON(ctx, url+"/v1/nodes/register", map[string]string{"node_id": state.NodeID}, &regResp); err != nil {
			time.Sleep(time.Second)
			continue
		}
		break
	}
	if regResp.NodeID == "" {
		// Could not reach supervisor; become leader.
		return selfElectLeader(ctx)
	}

	stateMu.Lock()
	state.NodeID = regResp.NodeID
	if err := saveState(state); err != nil {
		stateMu.Unlock()
		return err
	}
	stateMu.Unlock()
	if logx.L != nil {
		logx.L.Info("registered node", "node_id", state.NodeID)
	}

	var plan map[string]any
	if err := postJSON(ctx, url+"/v1/nodes/plan", map[string]string{"node_id": state.NodeID}, &plan); err != nil {
		return err
	}
	if err := applyPlan(ctx, plan); err != nil {
		return err
	}
	if logx.L != nil {
		logx.L.Info("plan applied", "role", state.Role)
	}

	interval := time.Duration(regResp.TTL) * time.Second / 3
	if interval <= 0 {
		interval = 30 * time.Second
	}
	go sendHeartbeatLoop(ctx, interval)
	return nil
}

// applyPlan persists the plan and would start/stop services to match services[].
// Service control is intentionally omitted; only state persistence is handled here.
func applyPlan(ctx context.Context, plan any) error {
	m, _ := plan.(map[string]any)

	stateMu.Lock()
	defer stateMu.Unlock()

	if role, ok := m["role"].(string); ok {
		state.Role = role
	}
	if ep, ok := m["epoch"].(float64); ok {
		state.Epoch = int(ep)
	}
	if svcs, ok := m["services"].([]any); ok {
		state.Services = state.Services[:0]
		for _, s := range svcs {
			if str, ok := s.(string); ok {
				state.Services = append(state.Services, str)
			}
		}
	}

	return saveState(state)
}

// sendHeartbeatLoop periodically POSTs to /v1/nodes/heartbeat. On authorization
// errors it triggers a re-registration and exits, allowing the caller to spawn a
// new loop.
func sendHeartbeatLoop(ctx context.Context, interval time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()
	url := supervisorURL() + "/v1/nodes/heartbeat"

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			stateMu.RLock()
			nid := state.NodeID
			stateMu.RUnlock()

			var resp *http.Response
			var err error
			body := map[string]string{"node_id": nid}
			if resp, err = client.Post(url, "application/json", mustJSON(body)); err != nil {
				continue
			}
			resp.Body.Close()
			if logx.L != nil {
				logx.L.Debug("heartbeat", "status", resp.StatusCode)
			}
			if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden || resp.StatusCode == http.StatusNotFound {
				go func() { _ = runHandshake(ctx) }()
				return
			}
		}
	}
}

// selfElectLeader marks this node as leader and persists the new state.
func selfElectLeader(ctx context.Context) error {
	stateMu.Lock()
	defer stateMu.Unlock()

	s, err := loadState()
	if err != nil {
		return err
	}
	if s.NodeID == "" {
		host, _ := os.Hostname()
		s.NodeID = fmt.Sprintf("%s-%d", host, time.Now().UnixNano())
	}
	s.Role = "leader"
	s.Epoch++
	state = s
	if err := saveState(state); err != nil {
		return err
	}
	if logx.L != nil {
		logx.L.Info("self-elected leader", "node_id", state.NodeID, "epoch", state.Epoch)
	}
	return nil
}

// postJSON performs a POST with a JSON body and decodes the JSON response.
func postJSON(ctx context.Context, url string, req, resp any) error {
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, url, mustJSON(req))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	r, err := client.Do(httpReq)
	if err != nil {
		return err
	}
	defer r.Body.Close()
	if r.StatusCode >= 300 {
		return errors.New(r.Status)
	}
	if resp != nil {
		if err := json.NewDecoder(r.Body).Decode(resp); err != nil && !errors.Is(err, io.EOF) {
			return err
		}
	}
	return nil
}

func mustJSON(v any) *bytes.Reader {
	b, _ := json.Marshal(v)
	return bytes.NewReader(b)
}

func supervisorURL() string {
	if u := os.Getenv("SUPERVISOR_URL"); u != "" {
		return u
	}
	return "http://localhost:8080"
}

func stateFile() string {
	dir := os.Getenv("DISCOVERY_DATA_DIR")
	if dir == "" {
		dir = filepath.Join("data", "discovery")
	}
	os.MkdirAll(dir, 0o755)
	return filepath.Join(dir, "cluster.json")
}

func loadState() (clusterState, error) {
	path := stateFile()
	b, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return clusterState{}, nil
		}
		return clusterState{}, err
	}
	var s clusterState
	if err := json.Unmarshal(b, &s); err != nil {
		return clusterState{}, err
	}
	return s, nil
}

func saveState(s clusterState) error {
	path := stateFile()
	tmp := path + ".tmp"
	b, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	if err := os.WriteFile(tmp, b, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
