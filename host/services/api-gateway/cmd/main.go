// /host/services/api-gateway/cmd/main.go
package main

import (
	"context"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	"github.com/gorilla/websocket"

	"github.com/Cdaprod/ThatDamToolbox/host/services/api-gateway/pkg/middleware"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/middleware/backend"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/middleware/frontend"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/middleware/host"
)

var wsUpgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

var version = "dev"

func main() {
	logx.Init(logx.Config{
		Service: "api-gateway",
		Version: version,
		Level:   getEnv("LOG_LEVEL", "info"),
		Format:  getEnv("LOG_FORMAT", "auto"),
		Caller:  getEnv("LOG_CALLER", "short"),
		Time:    getEnv("LOG_TIME", "rfc3339ms"),
		NoColor: os.Getenv("LOG_NO_COLOR") == "1",
	})

	// 1) Configuration via flags
	addr := flag.String("addr", ":8080", "HTTP bind address")
	apiPrefix := flag.String("api-prefix", "/api/", "API route prefix")
	backendURL := flag.String("backend-url", "http://localhost:8000", "Upstream backend URL")
	jwtSecret := flag.String("jwt-secret", "your-jwt-secret", "JWT signing secret")
	staticDir := flag.String("static-dir", filepath.Join("docker", "web-app", "build"), "SPA build directory")
	mediaDir := flag.String("media-dir", "/data/media", "Media directory path")
	dbPath := flag.String("db-path", "/data/db/live.sqlite3", "Path to SQLite DB")
	cacheDur := flag.Duration("cache", 5*time.Minute, "Backend cache duration")
	rlPerMin := flag.Int("rate-limit", 60, "Requests per minute")
	flag.Parse()

	// 2) Base mux & handlers
	mux := http.NewServeMux()
	mux.HandleFunc(*apiPrefix+"health", healthHandler)
	mux.HandleFunc(*apiPrefix+"video/", videoHandler)
	mux.HandleFunc("/", frontendHandler)
	setupOverlayRoutes(mux)

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
		logx.L.Info("listening", "addr", *addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logx.L.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	logx.L.Info("shutting down")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logx.L.Error("shutdown error", "err", err)
		os.Exit(1)
	}
	logx.L.Info("shutdown complete")
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
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

	w.Header().Set("Content-Type", "video/mp4")
	w.Header().Set("Accept-Ranges", "bytes")
	http.ServeContent(w, r, stat.Name(), stat.ModTime(), f)
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
		logx.L.Error("websocket upgrade error", "err", err)
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
