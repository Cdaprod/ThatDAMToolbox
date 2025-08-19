// Package httpapi hosts HTTP handlers for auth-bridge.
package httpapi

import (
	"net/http"

	"github.com/Cdaprod/ThatDamToolbox/host/services/auth-bridge/internal/config"
)

// LoginHandler is a stub for initiating authentication.
// Example:
//
//	curl -v http://localhost:8081/login
func LoginHandler(_ config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/", http.StatusFound)
	}
}

// CallbackHandler is a stub for handling OIDC callbacks.
// Example:
//
//	curl -v http://localhost:8081/callback
func CallbackHandler(_ config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/", http.StatusFound)
	}
}

// LogoutHandler clears the session cookie.
// Example:
//
//	curl -X POST http://localhost:8081/logout
func LogoutHandler(cfg config.Config) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		http.SetCookie(w, &http.Cookie{
			Name:     "thatdam_session",
			Value:    "",
			Path:     "/",
			Domain:   cfg.CookieDomain,
			MaxAge:   -1,
			HttpOnly: true,
			Secure:   false,
			SameSite: http.SameSiteLaxMode,
		})
		w.WriteHeader(http.StatusNoContent)
	}
}
