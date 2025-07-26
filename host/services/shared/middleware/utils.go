// /host/services/shared/middleware/utils.go
package middleware

import (
    "net/http"
    "net/http/httputil"
    "net/url"
    "path/filepath"
    "strings"
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

func validateJWT(token, secret string) (*User, error) {
    // TODO: Implement proper JWT validation
    // This is a placeholder for now
    return &User{ID: "user123", Username: "testuser", Role: "user"}, nil
}

func proxyToPythonBackend(w http.ResponseWriter, r *http.Request, backendURL, prefix string) {
    target, _ := url.Parse(backendURL)
    proxy := httputil.NewSingleHostReverseProxy(target)
    
    // Remove prefix from path
    r.URL.Path = strings.TrimPrefix(r.URL.Path, prefix)
    
    proxy.ServeHTTP(w, r)
}