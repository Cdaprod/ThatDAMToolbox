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
	srv    *http.Server
	logger *slog.Logger
}

// New constructs a HTTP server with timeouts.
func New(addr string, handler http.Handler, logger *slog.Logger, timeouts map[string]time.Duration) *Server {
	s := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  timeouts["read"],
		WriteTimeout: timeouts["write"],
		IdleTimeout:  timeouts["idle"],
	}
	return &Server{srv: s, logger: logger}
}

// Start begins ListenAndServe (non‐blocking if you call it in a goroutine).
func (s *Server) Start() {
	s.logger.Info("🚀 starting server", "addr", s.srv.Addr)
	if err := s.srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
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
