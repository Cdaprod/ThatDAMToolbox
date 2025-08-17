// Package httpapi hosts HTTP handlers for auth-bridge.
//
// HealthHandler returns 200 OK to indicate liveness.
package httpapi

import "net/http"

// HealthHandler returns 200 OK to indicate liveness.
func HealthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte("OK"))
}
