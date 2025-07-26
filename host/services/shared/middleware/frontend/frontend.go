// ================================
// /host/services/shared/middleware/frontend.go
// FRONTEND MIDDLEWARE (UI Layer)
// ================================
package frontend

import (
    "context"
    "fmt"
    "net/http"
    "net/url"
    "net/http/httputil"
    "path"
    "path/filepath"
    "strings"
    "time"
)

// StaticFileMiddleware serves static assets with proper caching
func StaticFileMiddleware(staticDir string, maxAge time.Duration) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Check if this is a static file request
            if isStaticFile(r.URL.Path) {
                filePath := filepath.Join(staticDir, r.URL.Path)
                
                // Set cache headers
                w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", int(maxAge.Seconds())))
                w.Header().Set("Expires", time.Now().Add(maxAge).Format(http.TimeFormat))
                
                http.ServeFile(w, r, filePath)
                return
            }
            
            next.ServeHTTP(w, r)
        })
    }
}

// SPAMiddleware handles Single Page Application routing
func SPAMiddleware(indexPath string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Check if this is an API request
            if strings.HasPrefix(r.URL.Path, "/api/") {
                next.ServeHTTP(w, r)
                return
            }
            
            // Check if this is a static file
            if isStaticFile(r.URL.Path) {
                next.ServeHTTP(w, r)
                return
            }
            
            // Serve index.html for all other routes (SPA routing)
            http.ServeFile(w, r, indexPath)
        })
    }
}

// CSPMiddleware adds Content Security Policy headers
func CSPMiddleware(policy string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            w.Header().Set("Content-Security-Policy", policy)
            w.Header().Set("X-Content-Type-Options", "nosniff")
            w.Header().Set("X-Frame-Options", "DENY")
            w.Header().Set("X-XSS-Protection", "1; mode=block")
            
            next.ServeHTTP(w, r)
        })
    }
}

// CompressionMiddleware adds gzip compression
func CompressionMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Check if client accepts gzip
        if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
            next.ServeHTTP(w, r)
            return
        }
        
        // Check if response should be compressed
        if !shouldCompress(r.URL.Path) {
            next.ServeHTTP(w, r)
            return
        }
        
        w.Header().Set("Content-Encoding", "gzip")
        w.Header().Set("Vary", "Accept-Encoding")
        
        gzw := &gzipResponseWriter{ResponseWriter: w}
        defer gzw.Close()
        
        next.ServeHTTP(gzw, r)
    })
}

// ================================
// HELPER FUNCTIONS AND TYPES
// ================================

// User represents an authenticated user
type User struct {
    ID       string `json:"id"`
    Username string `json:"username"`
    Role     string `json:"role"`
}

// Response recorder for logging
type responseRecorder struct {
    http.ResponseWriter
    statusCode int
}

func (r *responseRecorder) WriteHeader(code int) {
    r.statusCode = code
    r.ResponseWriter.WriteHeader(code)
}

// Cache entry structure
type cacheEntry struct {
    body        []byte
    contentType string
    statusCode  int
    timestamp   time.Time
}

// Cache recorder for caching middleware
type cacheRecorder struct {
    http.ResponseWriter
    body       []byte
    statusCode int
}

func (r *cacheRecorder) Write(data []byte) (int, error) {
    r.body = append(r.body, data...)
    return r.ResponseWriter.Write(data)
}

func (r *cacheRecorder) WriteHeader(code int) {
    r.statusCode = code
    r.ResponseWriter.WriteHeader(code)
}

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
    // Implement JWT validation logic here
    // This is a placeholder
    return &User{ID: "user123", Username: "testuser", Role: "user"}, nil
}

func proxyToPythonBackend(w http.ResponseWriter, r *http.Request, backendURL, prefix string) {
    target, _ := url.Parse(backendURL)
    proxy := httputil.NewSingleHostReverseProxy(target)
    
    // Remove prefix from path
    r.URL.Path = strings.TrimPrefix(r.URL.Path, prefix)
    
    proxy.ServeHTTP(w, r)
}