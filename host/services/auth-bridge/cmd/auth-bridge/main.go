// Command auth-bridge provides a minimal OIDC bridge between Auth0 and Keycloak.
//
// Usage:
//
//	OIDC_PROVIDER=auth0 go run ./cmd/auth-bridge
package main

import (
	"log"
	"net/http"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/auth-bridge/internal/config"
	"github.com/Cdaprod/ThatDamToolbox/host/services/auth-bridge/internal/server"
)

func main() {
	cfg := config.Load()
	mux := server.BuildMux(cfg)
	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("auth-bridge listening on %s (provider=%s issuer=%s)", cfg.Addr, cfg.Provider, cfg.Issuer)
	log.Fatal(srv.ListenAndServe())
}
