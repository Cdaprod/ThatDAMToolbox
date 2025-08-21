package main

import (
        "encoding/json"
        "net/http"
        "os"
        "path/filepath"
        "runtime"

        "github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor/plan"
        "github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
        "gopkg.in/yaml.v3"
)

// Handshake route handlers with basic policy enforcement.
// Example: curl -X POST http://localhost:8070/v1/nodes/register -d '{}'

// nodesList returns a snapshot of registered agents.
// Example: curl http://localhost:8070/v1/nodes
func nodesList(w http.ResponseWriter, r *http.Request) {
        if r.Method != http.MethodGet {
                http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
                return
        }
        p, err := auth(r)
        if err != nil {
                http.Error(w, err.Error(), http.StatusUnauthorized)
                return
        }
        if !policy.Allow(r.Context(), p, ports.ActPlan) {
                http.Error(w, "forbidden", http.StatusForbidden)
                return
        }
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(reg.Snapshot())
}

func nodesRegister(w http.ResponseWriter, r *http.Request) {
	p, err := auth(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	if !policy.Allow(r.Context(), p, ports.ActRegister) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"registered": true})
}

func nodesPlan(w http.ResponseWriter, r *http.Request) {
	p, err := auth(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	if !policy.Allow(r.Context(), p, ports.ActPlan) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	var req struct {
		NodeID       string `json:"node_id"`
		RoleHint     string `json:"role_hint"`
		Capabilities struct {
			VideoDevices int `json:"video_devices"`
		} `json:"capabilities"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	_ = runtime.GOOS // future branching

	var resp plan.DesiredPlan
	resp.Version = 1
	resp.Node = req.NodeID

	switch {
	case req.RoleHint == "server":
		if resp.Apps, err = loadPlanTemplate("server"); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	case req.RoleHint == "" && req.Capabilities.VideoDevices >= 1:
		if resp.Apps, err = loadPlanTemplate("camera-proxy"); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

// loadPlanTemplate reads a YAML plan template from ./plans and returns its apps.
// Example: loadPlanTemplate("server")
func loadPlanTemplate(name string) ([]plan.AppSpec, error) {
	var out struct {
		Apps []plan.AppSpec `yaml:"apps"`
	}
	_, file, _, _ := runtime.Caller(0)
	p := filepath.Join(filepath.Dir(file), "..", "..", "plans", name+".yaml")
	b, err := os.ReadFile(p)
	if err != nil {
		return nil, err
	}
	if err := yaml.Unmarshal(b, &out); err != nil {
		return nil, err
	}
	return out.Apps, nil
}

func nodesHeartbeat(w http.ResponseWriter, r *http.Request) {
	p, err := auth(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	if !policy.Allow(r.Context(), p, ports.ActHeartbeat) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func leaderClaim(w http.ResponseWriter, r *http.Request) {
	p, err := auth(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	if !policy.Allow(r.Context(), p, ports.ActLeader) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	resp := map[string]any{
		"granted":    false,
		"leader_url": "http://supervisor:8070",
		"epoch":      1,
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func leaderGet(w http.ResponseWriter, r *http.Request) {
	http.NotFound(w, r)
}
