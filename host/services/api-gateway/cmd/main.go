// /host/services/api-gateway/cmd/main.go
package main

import (
    "context"
    "flag"
    "fmt"
    "io"
    "log"
    "net/http"
    "os"
    "os/signal"
    "path/filepath"
    "strconv"
    "strings"
    "syscall"
    "time"

    "github.com/gorilla/websocket"

    "github.com/Cdaprod/ThatDamToolbox/host/services/api-gateway/pkg/middleware"
    "github.com/Cdaprod/ThatDamToolbox/host/services/shared/middleware/backend"
    "github.com/Cdaprod/ThatDamToolbox/host/services/shared/middleware/frontend"
    "github.com/Cdaprod/ThatDamToolbox/host/services/shared/middleware/host"
)

var wsUpgrader = websocket.Upgrader{
    CheckOrigin: func(r *http.Request) bool { return true },
}

func main() {
    // 1) Configuration via flags
    addr       := flag.String("addr", ":8080", "HTTP bind address")
    apiPrefix  := flag.String("api-prefix", "/api/", "API route prefix")
    backendURL := flag.String("backend-url", "http://localhost:8000", "Upstream backend URL")
    jwtSecret  := flag.String("jwt-secret", "your-jwt-secret", "JWT signing secret")
    staticDir  := flag.String("static-dir", filepath.Join("docker", "web-app", "build"), "SPA build directory")
    mediaDir   := flag.String("media-dir", "/data/media", "Media directory path")
    dbPath     := flag.String("db-path", "/data/db/live.sqlite3", "Path to SQLite DB")
    cacheDur   := flag.Duration("cache", 5*time.Minute, "Backend cache duration")
    rlPerMin   := flag.Int("rate-limit", 60, "Requests per minute")
    flag.Parse()

    // 2) Base mux & handlers
    mux := http.NewServeMux()
    mux.HandleFunc(*apiPrefix+"health", healthHandler)
    mux.HandleFunc(*apiPrefix+"video/", videoHandler)
    mux.HandleFunc("/", frontendHandler)

    // 3) Build middleware chain
    chain := middleware.New().
        Use(host.SystemResourceMiddleware).
        Use(host.ProcessLimitMiddleware(100)).
        Use(host.FileSystemMiddleware([]string{*mediaDir, filepath.Dir(*dbPath)})).
        Use(backend.RequestLoggingMiddleware).
        Use(backend.RateLimitMiddleware(*rlPerMin)).
        Use(backend.APIGatewayMiddleware(map[string]string{
            *apiPrefix: *backendURL,
        })).
        Use(backend.AuthenticationMiddleware(*jwtSecret)).
        Use(backend.CacheMiddleware(*cacheDur)).
        Use(frontend.CSPMiddleware("default-src 'self'; script-src 'self' 'unsafe-inline'")).
        Use(frontend.StaticFileMiddleware(*staticDir, 24*time.Hour)).
        Use(frontend.SPAMiddleware(filepath.Join(*staticDir, "index.html"))).
        Use(frontend.CompressionMiddleware).
        // custom:
        Use(MediaStreamingMiddleware(*mediaDir)).
        Use(WebSocketUpgradeMiddleware).
        Use(DatabaseConnectionMiddleware(*dbPath))

    handler := chain.Build(mux)

    // 4) HTTP server with timeouts
    srv := &http.Server{
        Addr:         *addr,
        Handler:      handler,
        ReadTimeout:  5 * time.Second,
        WriteTimeout: 10 * time.Second,
        IdleTimeout:  120 * time.Second,
    }

    // 5) Start & graceful shutdown
    go func() {
        log.Printf("🚀 Listening on %s", *addr)
        if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
            log.Fatalf("ListenAndServe: %v", err)
        }
    }()

    stop := make(chan os.Signal, 1)
    signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
    <-stop

    log.Println("⚙️  Shutting down…")
    ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
    defer cancel()
    if err := srv.Shutdown(ctx); err != nil {
        log.Fatalf("Shutdown error: %v", err)
    }
    log.Println("✅ Shutdown complete")
}

// Handlers
func healthHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "application/json")
    w.WriteHeader(http.StatusOK)
    w.Write([]byte(`{"status":"healthy"}`))
}

func videoHandler(w http.ResponseWriter, r *http.Request) {
    // Proxy /video/ to your Python backend API via APIGatewayMiddleware.
    // This stub simply returns JSON; remove if APIGatewayMiddleware handles it.
    w.Header().Set("Content-Type", "application/json")
    w.Write([]byte(`{"message":"Video API endpoint"}`))
}

func frontendHandler(w http.ResponseWriter, r *http.Request) {
    w.Write([]byte("Frontend content"))
}

// MediaStreamingMiddleware handles Range requests at /stream/
func MediaStreamingMiddleware(mediaPath string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if strings.HasPrefix(r.URL.Path, "/stream/") {
                handleVideoStream(w, r, mediaPath)
                return
            }
            next.ServeHTTP(w, r)
        })
    }
}

func handleVideoStream(w http.ResponseWriter, r *http.Request, mediaPath string) {
    videoID := strings.TrimPrefix(r.URL.Path, "/stream/")
    filePath := filepath.Join(mediaPath, videoID)

    f, err := os.Open(filePath)
    if err != nil {
        http.NotFound(w, r)
        return
    }
    defer f.Close()

    stat, err := f.Stat()
    if err != nil {
        http.Error(w, "File stat error", http.StatusInternalServerError)
        return
    }

    size := stat.Size()
    w.Header().Set("Content-Type", "video/mp4")
    w.Header().Set("Accept-Ranges", "bytes")

    if rng := r.Header.Get("Range"); rng != "" {
        handleRangeRequest(w, r, f, size)
        return
    }

    // No Range header → full content
    w.Header().Set("Content-Length", strconv.FormatInt(size, 10))
    http.ServeContent(w, r, stat.Name(), stat.ModTime(), f)
}

// handleRangeRequest serves a single byte-range (no multipart)
func handleRangeRequest(w http.ResponseWriter, r *http.Request, f *os.File, size int64) {
    ranges, err := http.ParseRange(r.Header.Get("Range"), size)
    if err != nil || len(ranges) == 0 {
        // Fallback: serve full
        http.ServeContent(w, r, f.Name(), time.Now(), f)
        return
    }
    ra := ranges[0]
    start, length := ra.Start, ra.Length
    end := start + length - 1

    w.Header().Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, end, size))
    w.Header().Set("Content-Length", strconv.FormatInt(length, 10))
    w.WriteHeader(http.StatusPartialContent)

    f.Seek(start, io.SeekStart)
    io.CopyN(w, f, length)
}

// WebSocketUpgradeMiddleware upgrades /ws/ to a simple echo server
func WebSocketUpgradeMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        if strings.HasPrefix(r.URL.Path, "/ws/") {
            handleWebSocketUpgrade(w, r)
            return
        }
        next.ServeHTTP(w, r)
    })
}

func handleWebSocketUpgrade(w http.ResponseWriter, r *http.Request) {
    conn, err := wsUpgrader.Upgrade(w, r, nil)
    if err != nil {
        log.Printf("WebSocket upgrade error: %v", err)
        return
    }
    defer conn.Close()

    for {
        mt, msg, err := conn.ReadMessage()
        if err != nil {
            break
        }
        // Echo back
        if err := conn.WriteMessage(mt, msg); err != nil {
            break
        }
    }
}

// DatabaseConnectionMiddleware: basic file‐exists health check
func DatabaseConnectionMiddleware(dbPath string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            if !isDatabaseHealthy(dbPath) {
                http.Error(w, "Database unavailable", http.StatusServiceUnavailable)
                return
            }
            ctx := context.WithValue(r.Context(), "db_path", dbPath)
            next.ServeHTTP(w, r.WithContext(ctx))
        })
    }
}

func isDatabaseHealthy(path string) bool {
    info, err := os.Stat(path)
    return err == nil && !info.IsDir()
}