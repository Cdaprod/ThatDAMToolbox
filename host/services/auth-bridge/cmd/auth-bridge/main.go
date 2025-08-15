// Command auth-bridge provides a minimal OIDC bridge between Auth0 and
// Keycloak.
//
// Usage:
//
//	OIDC_PROVIDER=auth0 go run ./cmd/auth-bridge
package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"
)

// Minimal config (OIDC internals can be added later)
type Config struct {
	Provider       string
	Issuer         string
	ClientID       string
	ClientSecret   string
	Scopes         string
	RedirectBase   string
	CookieDomain   string
	AllowedOrigins []string
	Addr           string
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func loadConfig() Config {
	return Config{
		Provider:     env("OIDC_PROVIDER", "auth0"),
		Issuer:       env("OIDC_ISSUER", ""),
		ClientID:     env("OIDC_CLIENT_ID", ""),
		ClientSecret: env("OIDC_CLIENT_SECRET", ""),
		Scopes:       env("OIDC_SCOPES", "openid profile email"),
		RedirectBase: env("AUTH_REDIRECT_BASE", "http://localhost:8081"),
		CookieDomain: env("AUTH_COOKIE_DOMAIN", "localhost"),
		Addr:         env("ADDR", ":8081"),
	}
}

func main() {
	cfg := loadConfig()
	mux := buildMux(cfg)
	srv := &http.Server{
		Addr:              cfg.Addr,
		Handler:           mux,
		ReadHeaderTimeout: 5 * time.Second,
	}
	log.Printf("auth-bridge listening on %s (provider=%s issuer=%s)", cfg.Addr, cfg.Provider, cfg.Issuer)
	log.Fatal(srv.ListenAndServe())
}

func buildMux(cfg Config) *http.ServeMux {
	mux := http.NewServeMux()

	// Health
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	})

	// Session (placeholder normalized profile)
	mux.HandleFunc("/session/me", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		resp := map[string]any{
			"sub":   "placeholder",
			"email": "demo@example.com",
			"name":  "Demo User",
			"roles": []string{"viewer"},
			"exp":   time.Now().Add(1 * time.Hour).Unix(),
		}
		_ = json.NewEncoder(w).Encode(resp)
	})

	// Login/Callback/Logout stubs (safe to replace with real OIDC)
	mux.HandleFunc("/login", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/", http.StatusFound)
	})
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/", http.StatusFound)
	})
	mux.HandleFunc("/logout", func(w http.ResponseWriter, r *http.Request) {
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
	})

	return mux
}
