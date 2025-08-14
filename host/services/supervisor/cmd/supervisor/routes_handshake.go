package main

import (
	"encoding/json"
	"net/http"
)

// Stub route handlers for handshake endpoints (no internals).
// Wire these in main.go mux when you implement.
// Example: curl -X POST http://localhost:8070/v1/nodes/register -d '{}'

func nodesRegister(w http.ResponseWriter, r *http.Request) {
	// TODO: auth, decode payload, upsert node registry, emit overlay.register
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"registered": true})
}

func nodesPlan(w http.ResponseWriter, r *http.Request) {
	// TODO: auth, read node_id, compute desired role/services based on policy/leader
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
	// TODO: auth, decode payload, refresh TTL, emit overlay.heartbeat
	w.WriteHeader(http.StatusNoContent)
}

func leaderClaim(w http.ResponseWriter, r *http.Request) {
	// TODO: auth, CAS leader; if no current or expired, grant and bump epoch
	resp := map[string]any{
		"granted":    false,
		"leader_url": "http://supervisor:8070",
		"epoch":      1,
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func leaderGet(w http.ResponseWriter, r *http.Request) {
	// TODO: return current leader if present, else 404
	http.NotFound(w, r)
}
