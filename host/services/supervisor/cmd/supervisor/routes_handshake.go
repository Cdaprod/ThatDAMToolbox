package main

import (
	"encoding/json"
	"net/http"
	"runtime"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor/plan"
	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// Handshake route handlers with basic policy enforcement.
// Example: curl -X POST http://localhost:8070/v1/nodes/register -d '{}'

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
		NodeID   string `json:"node_id"`
		RoleHint string `json:"role_hint"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	_ = runtime.GOOS // future branching

	var resp plan.DesiredPlan
	resp.Version = 1
	resp.Node = req.NodeID

	if req.RoleHint == "server" {
		resp.Apps = []plan.AppSpec{
			{
				Name: "media-api", Kind: "go",
				Cwd:     "/host/services/media-api",
				Command: []string{"./media-api"},
				Env:     map[string]string{"PORT": "8080"},
				Ports:   []int{8080},
				Restart: "always",
				Health:  &plan.HealthCheck{HTTP: "http://127.0.0.1:8080/health", IntervalSec: 5, TimeoutSec: 30},
			},
			{
				Name: "video-web", Kind: "nextjs",
				Cwd: "/web/video",
				Build: &plan.BuildSpec{
					Kind:     plan.BuildNextJS,
					Strategy: "standalone",
					Command:  []string{"npm", "ci"},
					OutDir:   ".next/standalone",
					Env:      map[string]string{"NEXT_TELEMETRY_DISABLED": "1"},
				},
				Command: []string{"node", ".next/standalone/server.js"},
				Env:     map[string]string{"PORT": "3000"},
				Ports:   []int{3000},
				After:   []string{"media-api"},
				Restart: "always",
				Health:  &plan.HealthCheck{HTTP: "http://127.0.0.1:3000/health", IntervalSec: 5, TimeoutSec: 60},
			},
		}
	} else {
		resp.Apps = []plan.AppSpec{{
			Name: "camera-proxy", Kind: "go",
			Cwd:     "/host/services/camera-proxy",
			Command: []string{"./camera-proxy"},
			Env:     map[string]string{"UPSTREAM_HOST": "api-gateway", "UPSTREAM_PORT": "8080"},
			Restart: "always",
		}}
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
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
