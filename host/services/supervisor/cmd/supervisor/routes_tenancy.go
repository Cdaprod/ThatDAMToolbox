package main

import (
	"encoding/json"
	"net/http"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
	"github.com/Cdaprod/ThatDamToolbox/host/shared/tenant"
)

// tenancyPlan computes a tenancy Plan based on profile and cluster state.
//
// Example:
//
//	curl -X POST http://localhost:8070/v1/tenancy/plan \
//	  -d '{"profile":"dev","cluster":{"nodes":1}}'
func tenancyPlan(w http.ResponseWriter, r *http.Request) {
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
		Profile string `json:"profile"`
		Cluster struct {
			Nodes int `json:"nodes"`
		} `json:"cluster"`
	}
	_ = json.NewDecoder(r.Body).Decode(&req)

	plan := tenant.PlanFor(tenant.Profile(req.Profile), tenant.ClusterState{Nodes: req.Cluster.Nodes})
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(plan)
}
