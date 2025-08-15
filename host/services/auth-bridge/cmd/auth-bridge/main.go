// Command auth-bridge provides a minimal OIDC bridge between Auth0 and
// Keycloak.
//
// Usage:
//
//	OIDC_PROVIDER=auth0 go run ./cmd/auth-bridge
package main

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"sync"
	"text/template"
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

	// Runner registration (stub demonstrating script generation and logging)
	mux.HandleFunc("/runners/register", registerRunnerHandler)

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

// RunnerRegistration represents a minimal log entry for a runner script request.
type RunnerRegistration struct {
	ID      string
	Profile string
	Created time.Time
}

// RunnerStore logs runner registration metadata.
type RunnerStore interface {
	Log(RunnerRegistration) error
}

// memoryStore is an in-memory RunnerStore used for demos and tests.
type memoryStore struct {
	mu   sync.Mutex
	logs []RunnerRegistration
}

func (m *memoryStore) Log(r RunnerRegistration) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.logs = append(m.logs, r)
	return nil
}

// runnerStore is the default store used by the service. Tests may replace it.
var runnerStore RunnerStore = &memoryStore{}

var runnerScript = template.Must(template.New("script").Parse(`#!/bin/sh
# Runner registration script
TOKEN="{{.Token}}"
PROFILE="{{.Profile}}"

echo "Registering $PROFILE with token $TOKEN"
`))

// registerRunnerHandler handles POST /runners/register and returns a shell
// script that self-registers a runner.
// Example:
//
//	curl -X POST http://localhost:8081/runners/register -d '{"profile":"capture"}'
func registerRunnerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req struct {
		Profile string `json:"profile"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid json", http.StatusBadRequest)
		return
	}
	token, err := generateToken()
	if err != nil {
		http.Error(w, "token error", http.StatusInternalServerError)
		return
	}
	_ = runnerStore.Log(RunnerRegistration{ID: token, Profile: req.Profile, Created: time.Now()})
	applySupervisorFlags(req.Profile)
	w.Header().Set("Content-Type", "text/plain")
	if err := runnerScript.Execute(w, map[string]string{"Token": token, "Profile": req.Profile}); err != nil {
		http.Error(w, "template error", http.StatusInternalServerError)
		return
	}
}

func generateToken() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return hex.EncodeToString(b), nil
}

// applySupervisorFlags is a stub for integration with supervisor feature toggling.
func applySupervisorFlags(profile string) {
	log.Printf("supervisor features toggled for profile=%s", profile)
}
