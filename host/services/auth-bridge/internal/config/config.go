// Package config loads environment variables for auth-bridge.
//
// Usage:
//
//	cfg := config.Load()
//	_ = cfg.Provider
package config

import "os"

// Config contains minimal auth-bridge configuration.
type Config struct {
	Provider       string
	Issuer         string
	ClientID       string
	ClientSecret   string
	Scopes         string
	RedirectBase   string
	CookieDomain   string
	AllowedOrigins []string // reserved for future CORS work
	TenancyURL     string
	Addr           string
}

func env(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// Load reads configuration from environment variables.
func Load() Config {
	return Config{
		Provider:     env("OIDC_PROVIDER", "auth0"),
		Issuer:       env("OIDC_ISSUER", ""),
		ClientID:     env("OIDC_CLIENT_ID", ""),
		ClientSecret: env("OIDC_CLIENT_SECRET", ""),
		Scopes:       env("OIDC_SCOPES", "openid profile email"),
		RedirectBase: env("AUTH_REDIRECT_BASE", "http://localhost:8081"),
		CookieDomain: env("AUTH_COOKIE_DOMAIN", "localhost"),
		TenancyURL:   env("TENANCY_URL", ""),
		Addr:         env("ADDR", ":8081"),
	}
}
