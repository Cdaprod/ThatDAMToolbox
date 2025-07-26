// host/services/api-gateway/cmd/main.go
package main

import (
    "fmt"
    "log"
    "net/http"
    "time"
    
    "ThatDamToolbox/host/services/shared/middleware/host"
    "ThatDamToolbox/host/services/shared/middleware/backend"
    "ThatDamToolbox/host/services/shared/middleware/frontend"
)

func main() {
    // Create base handler
    mux := http.NewServeMux()
    
    // Add your application routes
    mux.HandleFunc("/api/health", healthHandler)
    mux.HandleFunc("/api/video/", videoHandler)
    mux.HandleFunc("/", frontendHandler)
    
    // Chain middleware from outside-in (host -> backend -> frontend -> app)
    handler := host.SystemResourceMiddleware(
        host.ProcessLimitMiddleware(100)(
            host.FileSystemMiddleware([]string{"/data/media", "/data/db"})(
                backend.RequestLoggingMiddleware(
                    backend.RateLimitMiddleware(60)(
                        backend.APIGatewayMiddleware(map[string]string{
                            "/api/": "http://localhost:8000",
                        })(
                            backend.AuthenticationMiddleware("your-jwt-secret")(
                                backend.CacheMiddleware(5*time.Minute)(
                                    frontend.CSPMiddleware("default-src 'self'; script-src 'self' 'unsafe-inline'")(
                                        frontend.StaticFileMiddleware("/static", 24*time.Hour)(
                                            frontend.SPAMiddleware("/docker/web-app/build/index.html")(
                                                frontend.CompressionMiddleware(mux),
                                            ),
                                        ),
                                    ),
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        ),
    )
    
    fmt.Println("Starting server on :8080")
    log.Fatal(http.ListenAndServe(":8080", handler))
}

// Example handlers
func healthHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status": "healthy"}`))
}

func videoHandler(w http.ResponseWriter, r *http.Request) {
    // This would normally be proxied to your Python backend
    // but you can add Go-specific video processing here
    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`{"message": "Video API endpoint"}`))
}

func frontendHandler(w http.ResponseWriter, r *http.Request) {
    // This will be handled by the SPA middleware
    w.Write([]byte("Frontend content"))
}

// ================================
// SPECIFIC MIDDLEWARE FOR YOUR USE CASE
// ================================

// MediaStreamingMiddleware - optimized for video streaming
func MediaStreamingMiddleware(mediaPath string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if strings.HasPrefix(r.URL.Path, "/stream/") {
                // Handle video streaming with range requests
                handleVideoStream(w, r, mediaPath)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

func handleVideoStream(w http.ResponseWriter, r *http.Request, mediaPath string) {
    // Extract video ID from path
    videoID := strings.TrimPrefix(r.URL.Path, "/stream/")
    filePath := filepath.Join(mediaPath, videoID)
    
    // Check if file exists
    file, err := os.Open(filePath)
    if err != nil {
        http.NotFound(w, r)
        return
    }
    defer file.Close()
    
    // Get file info
    stat, err := file.Stat()
    if err != nil {
        http.Error(w, "File stat error", http.StatusInternalServerError)
        return
    }
    
    // Set headers for video streaming
    w.Header().Set("Content-Type", "video/mp4")
    w.Header().Set("Accept-Ranges", "bytes")
    w.Header().Set("Content-Length", fmt.Sprintf("%d", stat.Size()))
    
    // Handle range requests for video seeking
    rangeHeader := r.Header.Get("Range")
    if rangeHeader != "" {
        handleRangeRequest(w, r, file, stat.Size())
        return
    }
    
    // Serve entire file
    http.ServeContent(w, r, stat.Name(), stat.ModTime(), file)
}

// WebSocketUpgradeMiddleware - for your camera monitoring
func WebSocketUpgradeMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if strings.HasPrefix(r.URL.Path, "/ws/") {
            // Upgrade to WebSocket
            handleWebSocketUpgrade(w, r)
            return
        }
        next.ServeHTTP(w, r)
    })
}

// DatabaseConnectionMiddleware - manages DB connections
func DatabaseConnectionMiddleware(dbPath string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            // Check database connectivity
            if !isDatabaseHealthy(dbPath) {
                http.Error(w, "Database unavailable", http.StatusServiceUnavailable)
                return
            }
            
            // Add database connection to context
            ctx := context.WithValue(r.Context(), "db_path", dbPath)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}

// ================================
// ENVIRONMENT-SPECIFIC CONFIGURATIONS
// ================================

// Development middleware stack
func developmentMiddleware(handler http.Handler) http.Handler {
    return host.SystemResourceMiddleware(
        backend.RequestLoggingMiddleware(
            backend.AuthenticationMiddleware("dev-secret")(
                frontend.CSPMiddleware("default-src 'self' 'unsafe-inline' 'unsafe-eval'")(
                    handler,
                ),
            ),
        ),
    )
}

// Production middleware stack
func productionMiddleware(handler http.Handler) http.Handler {
    return host.SystemResourceMiddleware(
        host.ProcessLimitMiddleware(1000)(
            host.FileSystemMiddleware([]string{"/data/media", "/data/db", "/data/logs"})(
                backend.RequestLoggingMiddleware(
                    backend.RateLimitMiddleware(120)(
                        backend.AuthenticationMiddleware("prod-secret")(
                            backend.CacheMiddleware(15*time.Minute)(
                                frontend.CSPMiddleware("default-src 'self'")(
                                    frontend.CompressionMiddleware(
                                        MediaStreamingMiddleware("/data/media")(
                                            WebSocketUpgradeMiddleware(
                                                DatabaseConnectionMiddleware("/data/db/live.sqlite3")(
                                                    handler,
                                                ),
                                            ),
                                        ),
                                    ),
                                ),
                            ),
                        ),
                    ),
                ),
            ),
        ),
    )
}

// ================================
// MIDDLEWARE CHAIN BUILDER
// ================================

type MiddlewareChain struct {
    middlewares []func(http.Handler) http.Handler
}

func NewMiddlewareChain() *MiddlewareChain {
    return &MiddlewareChain{}
}

func (mc *MiddlewareChain) Use(middleware func(http.Handler) http.Handler) *MiddlewareChain {
    mc.middlewares = append(mc.middlewares, middleware)
    return mc
}

func (mc *MiddlewareChain) Build(handler http.Handler) http.Handler {
    // Apply middleware in reverse order (last added = first executed)
    for i := len(mc.middlewares) - 1; i >= 0; i-- {
        handler = mc.middlewares[i](handler)
    }
    return handler
}

// Usage example with chain builder
func exampleWithChainBuilder() {
    mux := http.NewServeMux()
    mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
        w.Write([]byte("Hello World"))
    })
    
    chain := NewMiddlewareChain().
        Use(host.SystemResourceMiddleware).
        Use(backend.RequestLoggingMiddleware).
        Use(backend.RateLimitMiddleware(60)).
        Use(frontend.CompressionMiddleware)
    
    handler := chain.Build(mux)
    
    log.Fatal(http.ListenAndServe(":8080", handler))
}