// /host/services/media-api/pkg/handlers/health.go
// Package handlers provides HTTP handlers for the media API.
// Example:
//
//	http.HandleFunc("/api/v2/health", handlers.Health)
package handlers

import (
	"encoding/json"
	"net/http"
)

// Health responds with a simple JSON body confirming service availability.
func Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}
