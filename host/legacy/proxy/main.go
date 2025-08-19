// host/services/proxy/main.go
package main

import (
	"context"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/api-gateway/pkg/middleware"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/middleware/backend"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/middleware/frontend"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/middleware/host"
	"github.com/gorilla/websocket"
)

// Simple WebSocket‐to‐backend proxy
func WebSocketProxyMiddleware(prefix, targetURL string) func(http.Handler) http.Handler {
	target, _ := url.Parse(targetURL)
	upgrader := websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !strings.HasPrefix(r.URL.Path, prefix) {
				next.ServeHTTP(w, r)
				return
			}
			// client WS
			connIn, err := upgrader.Upgrade(w, r, nil)
			if err != nil {
				http.Error(w, err.Error(), 500)
				return
			}
			defer connIn.Close()

			// backend WS
			u := *target
			u.Scheme = "ws"
			u.Path = r.URL.Path
			connOut, _, err := websocket.DefaultDialer.Dial(u.String(), nil)
			if err != nil {
				http.Error(w, "backend dial: "+err.Error(), 502)
				return
			}
			defer connOut.Close()

			// bidirectional pump
			go func() { io.CopyConn(connOut.UnderlyingConn(), connIn.UnderlyingConn()) }()
			io.CopyConn(connIn.UnderlyingConn(), connOut.UnderlyingConn())
		})
	}
}

func main() {
	// 1) Build your middleware chain
	chain := middleware.New().
		Use(host.SystemResourceMiddleware). // host checks
		Use(host.FileSystemMiddleware([]string{"./build"})).
		Use(backend.RequestLoggingMiddleware). // API logging
		Use(backend.RateLimitMiddleware(200)). // API rate‐limit
		Use(backend.APIGatewayMiddleware(map[string]string{
			"/api/": "http://python-backend:8000",
		})).
		Use(WebSocketProxyMiddleware("/ws/assets", "http://python-backend:8000")).
		Use(frontend.CSPMiddleware("default-src 'self'")).
		Use(frontend.CompressionMiddleware).
		Use(frontend.StaticFileMiddleware("./build", 24*time.Hour)).
		Use(frontend.SPAMiddleware("./build/index.html"))

	// 2) Mount it on the default mux
	handler := chain.Build(http.NotFoundHandler())

	// 3) Run
	srv := &http.Server{
		Addr:         ":80",
		Handler:      handler,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  2 * time.Minute,
	}
	log.Println("▶️  Proxy listening on :80")
	log.Fatal(srv.ListenAndServe())
}
