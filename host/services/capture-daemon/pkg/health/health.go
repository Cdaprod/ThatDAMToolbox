// host/services/capture-daemon/pkg/health/health.go
package health

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

type Status string

const (
	StatusHealthy   Status = "healthy"
	StatusUnhealthy Status = "unhealthy"
)

type Check struct {
	Name    string    `json:"name"`
	Status  Status    `json:"status"`
	Message string    `json:"message,omitempty"`
	Checked time.Time `json:"checked"`
}

type HealthChecker struct {
	interval time.Duration
	checks   map[string]func(ctx context.Context) (Status, string, error)
	mu       sync.RWMutex
}

// New creates a health checker that runs every `interval`.
func New(interval time.Duration) *HealthChecker {
	return &HealthChecker{
		interval: interval,
		checks:   make(map[string]func(context.Context) (Status, string, error)),
	}
}

// AddCheck registers a named check function.
func (h *HealthChecker) AddCheck(name string, fn func(ctx context.Context) (Status, string, error)) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.checks[name] = fn
}

// Start runs checks on ticker until ctx.Done().
func (h *HealthChecker) Start(ctx context.Context) {
	t := time.NewTicker(h.interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			h.runAll(ctx)
		}
	}
}

func (h *HealthChecker) runAll(ctx context.Context) {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for _, fn := range h.checks {
		fn(ctx) // we ignore results here; Handler will run fresh
	}
}

// Handler returns an HTTP handler that reports health JSON.
func (h *HealthChecker) Handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		h.mu.RLock()
		defer h.mu.RUnlock()

		now := time.Now()
		result := make([]Check, 0, len(h.checks))
		overall := StatusHealthy

		for name, fn := range h.checks {
			st, msg, err := fn(r.Context())
			if err != nil {
				st = StatusUnhealthy
				msg = err.Error()
			}
			if st == StatusUnhealthy {
				overall = StatusUnhealthy
			}
			result = append(result, Check{
				Name:    name,
				Status:  st,
				Message: msg,
				Checked: now,
			})
		}

		resp := map[string]interface{}{
			"status":  overall,
			"checks":  result,
			"now":     now,
		}

		w.Header().Set("Content-Type", "application/json")
		if overall == StatusUnhealthy {
			w.WriteHeader(http.StatusServiceUnavailable)
		}
		json.NewEncoder(w).Encode(resp)
	}
}