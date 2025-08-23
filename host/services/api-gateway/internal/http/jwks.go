package http

import (
	"net/http"

	"github.com/Cdaprod/ThatDamToolbox/host/services/api-gateway/internal/keys"
)

// JWKSHandler serves the public JWKS set.
// Example:
//
//	mux.HandleFunc("/.well-known/jwks.json", JWKSHandler)
func JWKSHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("content-type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(keys.PublicJWKSJSON())
}
