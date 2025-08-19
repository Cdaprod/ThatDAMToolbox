// host/services/capture-daemon/pkg/server/server.go
package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"
)

type Server struct {
	srv      *http.Server
	logger   *slog.Logger
	certFile string
	keyFile  string
}

// New constructs a HTTP server with timeouts and optional TLS credentials.
func New(addr string, handler http.Handler, logger *slog.Logger, timeouts map[string]time.Duration, certFile, keyFile string) *Server {
	s := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  timeouts["read"],
		WriteTimeout: timeouts["write"],
		IdleTimeout:  timeouts["idle"],
	}
	return &Server{srv: s, logger: logger, certFile: certFile, keyFile: keyFile}
}

// Start begins serving HTTP or HTTPS depending on credentials provided.
// Call in a goroutine if non-blocking behavior is desired.
func (s *Server) Start() {
	s.logger.Info("🚀 starting server", "addr", s.srv.Addr)
	var err error
	if s.certFile != "" && s.keyFile != "" {
		err = s.srv.ListenAndServeTLS(s.certFile, s.keyFile)
	} else {
		err = s.srv.ListenAndServe()
	}
	if err != nil && err != http.ErrServerClosed {
		s.logger.Error("❌ server failed", "error", err)
	}
}

// Shutdown gracefully shuts down the server within ctx deadline.
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("🔌 shutting down server", "addr", s.srv.Addr)
	if err := s.srv.Shutdown(ctx); err != nil {
		return fmt.Errorf("shutdown failed: %w", err)
	}
	return nil
}
