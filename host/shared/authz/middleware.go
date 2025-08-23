package authz

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// Claims represents the standard claims embedded in tokens.
type Claims struct {
	Typ      string   `json:"typ"`
	TenantID string   `json:"tenant_id"`
	Roles    []string `json:"roles"`
	Scopes   []string `json:"scopes"`
	jwt.RegisteredClaims
}

const (
	issuer = "https://auth.thatdamtoolbox.cloud"
	aud    = "thatdamtoolbox"
)

type ctxKey string

var claimsKey ctxKey = "claims"

// WithAuth validates Bearer tokens using the configured JWKS and attaches
// claims to the request context. Example:
//
//	http.Handle("/assets", authz.WithAuth(http.HandlerFunc(Assets)))
func WithAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		h := r.Header.Get("Authorization")
		if !strings.HasPrefix(h, "Bearer ") {
			http.Error(w, "missing token", http.StatusUnauthorized)
			return
		}
		tokenStr := strings.TrimPrefix(h, "Bearer ")
		kf, err := Keyfunc()
		if err != nil {
			http.Error(w, "jwks unavailable", http.StatusServiceUnavailable)
			return
		}
		token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, kf,
			jwt.WithIssuer(issuer), jwt.WithAudience(aud))
		if err != nil || !token.Valid {
			http.Error(w, "invalid token", http.StatusUnauthorized)
			return
		}
		ctx := context.WithValue(r.Context(), claimsKey, token.Claims.(*Claims))
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// ClaimsFrom retrieves validated claims from the request.
func ClaimsFrom(r *http.Request) *Claims {
	c, _ := r.Context().Value(claimsKey).(*Claims)
	return c
}
