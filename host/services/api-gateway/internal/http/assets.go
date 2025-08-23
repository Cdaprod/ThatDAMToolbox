package http

import (
	"encoding/json"
	"net/http"

	authz "github.com/Cdaprod/ThatDamToolbox/host/shared/authz"
)

// AssetsHandler returns a placeholder asset list for the tenant in the token.
// Example:
//
//	req.Header.Set("Authorization", "Bearer <PAT>")
func AssetsHandler(w http.ResponseWriter, r *http.Request) {
	c := authz.ClaimsFrom(r)
	if c == nil || c.TenantID == "" {
		http.Error(w, "tenant_required", http.StatusForbidden)
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"ok": true, "tenant": c.TenantID})
}
