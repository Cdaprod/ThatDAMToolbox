// host/services/capture-daemon/pkg/shutdown/shutdown.go
package shutdown

import (
	"context"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"log/slog"
)

type Hook struct {
	Name string
	Func func(ctx context.Context) error
}

type Manager struct {
	logger  *slog.Logger
	hooks   []Hook
	mu      sync.Mutex
	timeout time.Duration
}

// NewManager returns a shutdown manager with given timeout for hooks.
func NewManager(logger *slog.Logger, timeout time.Duration) *Manager {
	return &Manager{logger: logger, timeout: timeout}
}

// AddHook registers a named cleanup function to run on shutdown.
func (m *Manager) AddHook(name string, fn func(ctx context.Context) error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.hooks = append(m.hooks, Hook{name, fn})
}

// Wait blocks until SIGINT/SIGTERM, then runs all hooks (with timeout) in parallel.
func (m *Manager) Wait(ctx context.Context) {
	sigc := make(chan os.Signal, 1)
	signal.Notify(sigc, os.Interrupt, syscall.SIGTERM)
	select {
	case sig := <-sigc:
		m.logger.Info("🛑 shutdown signal received", "signal", sig.String())
	case <-ctx.Done():
		m.logger.Info("🛑 context cancelled, shutting down")
	}
	m.execAll()
}

func (m *Manager) execAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	ctx, cancel := context.WithTimeout(context.Background(), m.timeout)
	defer cancel()

	var wg sync.WaitGroup
	for _, h := range m.hooks {
		wg.Add(1)
		go func(h Hook) {
			defer wg.Done()
			m.logger.Info("🔧 executing shutdown hook", "hook", h.Name)
			if err := h.Func(ctx); err != nil {
				m.logger.Error("❌ hook failed", "hook", h.Name, "error", err)
			} else {
				m.logger.Info("✅ hook completed", "hook", h.Name)
			}
		}(h)
	}
	wg.Wait()
	m.logger.Info("🎉 graceful shutdown complete")
}
