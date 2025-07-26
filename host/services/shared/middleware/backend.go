// ================================
// BACKEND MIDDLEWARE (API Layer)
// ================================

package backend

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "log"
    "net/http"
    "net/http/httputil"
    "net/url"
    "strings"
    "time"
)

// AuthenticationMiddleware validates JWT tokens and sets user context
func AuthenticationMiddleware(jwtSecret string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Skip auth for public endpoints
            if isPublicEndpoint(r.URL.Path) {
                next.ServeHTTP(w, r)
                return
            }
            
            authHeader := r.Header.Get("Authorization")
            if authHeader == "" {
                http.Error(w, "Authorization header required", http.StatusUnauthorized)
                return
            }
            
            token := strings.TrimPrefix(authHeader, "Bearer ")
            user, err := validateJWT(token, jwtSecret)
            if err != nil {
                http.Error(w, "Invalid token", http.StatusUnauthorized)
                return
            }
            
            // Add user to context
            ctx := context.WithValue(r.Context(), "user", user)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}

// APIGatewayMiddleware routes requests to appropriate backend services
func APIGatewayMiddleware(routes map[string]string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Check if this is an API route that needs proxying
            for prefix, backendURL := range routes {
                if strings.HasPrefix(r.URL.Path, prefix) {
                    proxyToPythonBackend(w, r, backendURL, prefix)
                    return
                }
            }
            
            // Continue to next handler for non-API routes
            next.ServeHTTP(w, r)
        })
    }
}

// RequestLoggingMiddleware logs all requests with timing
func RequestLoggingMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        start := time.Now()
        
        // Capture response
        recorder := &responseRecorder{ResponseWriter: w, statusCode: 200}
        
        next.ServeHTTP(recorder, r)
        
        log.Printf("[%s] %s %s %d %v %s",
            r.Method,
            r.URL.Path,
            r.RemoteAddr,
            recorder.statusCode,
            time.Since(start),
            r.UserAgent(),
        )
    })
}

// RateLimitMiddleware implements rate limiting per IP
func RateLimitMiddleware(requestsPerMinute int) func(http.Handler) http.Handler {
    clients := make(map[string][]time.Time)
    
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            ip := getClientIP(r)
            now := time.Now()
            
            // Clean old entries
            if times, exists := clients[ip]; exists {
                var recent []time.Time
                for _, t := range times {
                    if now.Sub(t) < time.Minute {
                        recent = append(recent, t)
                    }
                }
                clients[ip] = recent
            }
            
            // Check rate limit
            if len(clients[ip]) >= requestsPerMinute {
                http.Error(w, "Rate limit exceeded", http.StatusTooManyRequests)
                return
            }
            
            // Add current request
            clients[ip] = append(clients[ip], now)
            
            next.ServeHTTP(w, r)
        })
    }
}

// CacheMiddleware implements response caching
func CacheMiddleware(cacheDuration time.Duration) func(http.Handler) http.Handler {
    cache := make(map[string]cacheEntry)
    
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Only cache GET requests
            if r.Method != "GET" {
                next.ServeHTTP(w, r)
                return
            }
            
            key := r.URL.String()
            
            // Check cache
            if entry, exists := cache[key]; exists && time.Since(entry.timestamp) < cacheDuration {
                w.Header().Set("Content-Type", entry.contentType)
                w.Header().Set("X-Cache", "HIT")
                w.WriteHeader(entry.statusCode)
                w.Write(entry.body)
                return
            }
            
            // Capture response for caching
            recorder := &cacheRecorder{ResponseWriter: w}
            next.ServeHTTP(recorder, r)
            
            // Cache the response
            cache[key] = cacheEntry{
                body:        recorder.body,
                contentType: recorder.Header().Get("Content-Type"),
                statusCode:  recorder.statusCode,
                timestamp:   time.Now(),
            }
            
            w.Header().Set("X-Cache", "MISS")
        })
    }
}