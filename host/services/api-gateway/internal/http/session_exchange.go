package http

import (
	"encoding/json"
	"net/http"

	"github.com/Cdaprod/ThatDamToolbox/host/services/api-gateway/internal/tokens"
)

// requireSession validates an upstream session and extracts a user ID.
// In production this should verify a NextAuth session cookie. For development
// an X-User-ID header is accepted.
func requireSession(r *http.Request) (userID, tenant string, roles []string) {
	u := r.Header.Get("X-User-ID")
	if u == "" {
		return "", "", nil
	}
	return u, "demo", []string{"admin"}
}

// SessionExchangeHandler returns a Platform Access Token for a valid session.
// Example:
//
//	curl -H 'X-User-ID: dev' -X POST /auth/session/exchange
func SessionExchangeHandler(w http.ResponseWriter, r *http.Request) {
	user, tenant, roles := requireSession(r)
	if user == "" {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	pat, err := tokens.SignPAT("user_"+user, tenant, roles, []string{"ui:*", "api:*"})
	if err != nil {
		http.Error(w, "sign_error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("content-type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"access_token": pat,
		"token_type":   "Bearer",
		"expires_in":   1800,
	})
}
