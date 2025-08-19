// Package httpapi hosts HTTP handlers for auth-bridge.
package httpapi

import (
	"encoding/json"
	"net/http"
	"time"
)

// SessionMeHandler returns a placeholder normalized profile.
// Example:
//
//	curl http://localhost:8081/session/me
func SessionMeHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	resp := map[string]any{
		"sub":   "placeholder",
		"email": "demo@example.com",
		"name":  "Demo User",
		"roles": []string{"viewer"},
		"exp":   time.Now().Add(1 * time.Hour).Unix(),
	}
	_ = json.NewEncoder(w).Encode(resp)
}
