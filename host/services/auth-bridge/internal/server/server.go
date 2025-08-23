// Package server wires handlers into a mux.
package server

import (
	"net/http"

	"github.com/Cdaprod/ThatDamToolbox/host/services/auth-bridge/internal/config"
	"github.com/Cdaprod/ThatDamToolbox/host/services/auth-bridge/internal/httpapi"
	"github.com/Cdaprod/ThatDamToolbox/host/services/auth-bridge/internal/runners"
)

// BuildMux assembles all service endpoints.
func BuildMux(cfg config.Config) *http.ServeMux {
	mux := http.NewServeMux()

	mux.HandleFunc("/health", httpapi.HealthHandler)
	mux.HandleFunc("/session/me", httpapi.SessionMeHandler(cfg))

	store := runners.NewMemoryStore()
	mux.HandleFunc("/runners/register", runners.RegisterHandler(store))

	mux.HandleFunc("/login", httpapi.LoginHandler(cfg))
	mux.HandleFunc("/callback", httpapi.CallbackHandler(cfg))
	mux.HandleFunc("/logout", httpapi.LogoutHandler(cfg))

	mux.HandleFunc("/pair/start", httpapi.PairStart)
	mux.HandleFunc("/pair/poll", httpapi.PairPoll)

	return mux
}
