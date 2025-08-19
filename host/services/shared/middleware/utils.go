// /host/services/shared/middleware/utils.go
package middleware

import (
	"errors"
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	jwt "github.com/golang-jwt/jwt/v5"
)

// Helper functions
func isPublicEndpoint(path string) bool {
	publicPaths := []string{"/health", "/ping", "/login", "/register"}
	for _, p := range publicPaths {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}

func isStaticFile(path string) bool {
	staticExts := []string{".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".woff", ".woff2"}
	ext := filepath.Ext(path)
	for _, staticExt := range staticExts {
		if ext == staticExt {
			return true
		}
	}
	return false
}

func shouldCompress(path string) bool {
	compressibleTypes := []string{".html", ".css", ".js", ".json", ".xml", ".svg"}
	ext := filepath.Ext(path)
	for _, compType := range compressibleTypes {
		if ext == compType {
			return true
		}
	}
	return false
}

func getClientIP(r *http.Request) string {
	forwarded := r.Header.Get("X-Forwarded-For")
	if forwarded != "" {
		return strings.Split(forwarded, ",")[0]
	}
	return r.RemoteAddr
}

type jwtClaims struct {
	Username string `json:"username"`
	Role     string `json:"role"`
	jwt.RegisteredClaims
}

func validateJWT(token, secret string) (*User, error) {
	if secret == "" {
		secret = os.Getenv("JWT_SECRET")
	}
	if secret == "" {
		return nil, errors.New("jwt secret not configured")
	}

	claims := &jwtClaims{}
	parsed, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		if t.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, fmt.Errorf("unexpected signing method: %s", t.Header["alg"])
		}
		return []byte(secret), nil
	}, jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}))
	if err != nil {
		return nil, err
	}
	if !parsed.Valid {
		return nil, errors.New("invalid token")
	}

	return &User{ID: claims.Subject, Username: claims.Username, Role: claims.Role}, nil
}

func proxyToPythonBackend(w http.ResponseWriter, r *http.Request, backendURL, prefix string) {
	target, _ := url.Parse(backendURL)
	proxy := httputil.NewSingleHostReverseProxy(target)

	// Remove prefix from path
	r.URL.Path = strings.TrimPrefix(r.URL.Path, prefix)

	proxy.ServeHTTP(w, r)
}
