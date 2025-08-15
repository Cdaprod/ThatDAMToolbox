package main

import (
	"encoding/json"
	"net/http"

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
	resp := map[string]any{
		"role":              "worker",
		"services":          []string{"capture-daemon"},
		"control_plane_url": "http://supervisor:8070",
		"gateway_url":       "http://api-gateway:8080",
		"epoch":             1,
		"ttl_seconds":       45,
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
