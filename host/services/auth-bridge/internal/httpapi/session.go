// Package httpapi hosts HTTP handlers for auth-bridge.
package httpapi

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/auth-bridge/internal/config"
)

// membership mirrors the Tenancy service response.
type membership struct {
	ID       string `json:"id"`
	TenantID string `json:"tenant_id"`
	UserID   string `json:"user_id"`
	Role     string `json:"role"`
}

// SessionMeHandler returns a normalized profile and optional membership info.
// Example:
//
//	curl -H "X-User-ID: demo" http://localhost:8081/session/me
func SessionMeHandler(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		sub := r.Header.Get("X-User-ID")
		if sub == "" {
			sub = "demo"
		}

		resp := map[string]any{
			"sub":   sub,
			"email": sub + "@example.com",
			"name":  "Demo User",
			"roles": []string{"viewer"},
			"exp":   time.Now().Add(1 * time.Hour).Unix(),
		}

		if cfg.TenancyURL != "" {
			req, err := http.NewRequest(http.MethodPost, cfg.TenancyURL+"/login", nil)
			if err == nil {
				req.Header.Set("X-User-ID", sub)
				if tr, err := http.DefaultClient.Do(req); err == nil && tr.StatusCode == http.StatusOK {
					defer tr.Body.Close()
					var m membership
					if json.NewDecoder(tr.Body).Decode(&m) == nil {
						resp["membership"] = m
					}
				}
			}
		}

		_ = json.NewEncoder(w).Encode(resp)
	}
}
