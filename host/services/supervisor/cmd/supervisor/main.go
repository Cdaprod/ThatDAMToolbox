package main

// supervisor provides an optional control-plane for agents.
//
// Example:
//   go run ./cmd/supervisor/main.go -addr :8070

import (
	"context"
	"encoding/json"
	"errors"
	"flag"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/bus"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	"github.com/MicahParks/keyfunc"
	"github.com/golang-jwt/jwt/v4"
)

var version = "dev"

// Agent describes a registered agent.
type Agent struct {
	ID            string         `json:"id"`
	Class         string         `json:"class,omitempty"`
	Version       string         `json:"version,omitempty"`
	Features      []string       `json:"features,omitempty"`
	Status        string         `json:"status"`
	LastHeartbeat time.Time      `json:"last_heartbeat"`
	Address       string         `json:"address,omitempty"`
	Meta          map[string]any `json:"meta,omitempty"`
}

// Registry holds agents in memory.
type Registry struct {
	mu     sync.RWMutex
	agents map[string]*Agent
}

func NewRegistry() *Registry { return &Registry{agents: make(map[string]*Agent)} }

// Upsert adds or updates an agent entry.
func (r *Registry) Upsert(a Agent) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.agents[a.ID] = &a
}

// Heartbeat refreshes an agent's status and heartbeat timestamp.
func (r *Registry) Heartbeat(id string, meta map[string]any) {
	r.mu.Lock()
	defer r.mu.Unlock()
	a, ok := r.agents[id]
	if !ok {
		a = &Agent{ID: id}
		r.agents[id] = a
	}
	a.Status = "healthy"
	a.LastHeartbeat = time.Now()
	if meta != nil {
		if a.Meta == nil {
			a.Meta = make(map[string]any)
		}
		for k, v := range meta {
			a.Meta[k] = v
		}
	}
}

// Snapshot returns a copy of the registry.
func (r *Registry) Snapshot() []Agent {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Agent, 0, len(r.agents))
	for _, a := range r.agents {
		out = append(out, *a)
	}
	return out
}

// MarkStale marks agents stale if their heartbeat exceeds ttl.
func (r *Registry) MarkStale(ttl time.Duration) {
	cutoff := time.Now().Add(-ttl)
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, a := range r.agents {
		if a.Status == "healthy" && a.LastHeartbeat.Before(cutoff) {
			a.Status = "stale"
		}
	}
}

var (
	reg         *Registry
	apiKey      string
	jwks        *keyfunc.JWKS
	eventPrefix string
)

func main() {
	addr := flag.String("addr", ":8070", "HTTP bind address")
	jwksURL := flag.String("jwks-url", os.Getenv("JWKS_URL"), "JWKS endpoint URL")
	ttl := flag.Duration("stale-ttl", 30*time.Second, "stale TTL")
	flag.Parse()

	logx.Init(logx.Config{
		Service: "supervisor",
		Version: version,
		Level:   getEnv("LOG_LEVEL", "info"),
		Format:  getEnv("LOG_FORMAT", "auto"),
		Caller:  getEnv("LOG_CALLER", "short"),
		Time:    getEnv("LOG_TIME", "rfc3339ms"),
		NoColor: os.Getenv("LOG_NO_COLOR") == "1",
	})

	apiKey = os.Getenv("SUPERVISOR_API_KEY")
	eventPrefix = os.Getenv("EVENT_PREFIX")
	if eventPrefix == "" {
		eventPrefix = "overlay"
	}
	reg = NewRegistry()

	if *jwksURL != "" {
		var err error
		jwks, err = keyfunc.Get(*jwksURL, keyfunc.Options{RefreshInterval: time.Minute})
		if err != nil {
			logx.L.Error("load jwks", "err", err)
			os.Exit(1)
		}
	}

	if _, err := bus.Connect(context.Background(), bus.Config{}); err != nil {
		logx.L.Error("bus connection failed", "err", err)
	}

	go func() {
		ticker := time.NewTicker(*ttl)
		for range ticker.C {
			reg.MarkStale(*ttl)
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/v1/nodes/register", nodesRegister)
	mux.HandleFunc("/v1/nodes/plan", nodesPlan)
	mux.HandleFunc("/v1/nodes/heartbeat", nodesHeartbeat)
	mux.HandleFunc("/v1/leader/claim", leaderClaim)
	mux.HandleFunc("/v1/leader", leaderGet)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})
	mux.HandleFunc("/agents", agentsHandler)
	mux.HandleFunc("/register", registerHandler)
	mux.HandleFunc("/heartbeat", heartbeatHandler)

	srv := &http.Server{
		Addr:         *addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	logx.L.Info("supervisor listening", "addr", *addr)
	if err := srv.ListenAndServe(); err != nil {
		logx.L.Error("server failed", "err", err)
		os.Exit(1)
	}
}

func agentsHandler(w http.ResponseWriter, r *http.Request) {
	snap := reg.Snapshot()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(snap)
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	if err := auth(r); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	var a Agent
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	a.Status = "registered"
	a.LastHeartbeat = time.Now()
	reg.Upsert(a)
	publishEvent("register", a)
	w.WriteHeader(http.StatusOK)
}

func heartbeatHandler(w http.ResponseWriter, r *http.Request) {
	if err := auth(r); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	var payload struct {
		ID   string         `json:"id"`
		Meta map[string]any `json:"meta,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	reg.Heartbeat(payload.ID, payload.Meta)
	publishEvent("heartbeat", Agent{ID: payload.ID})
	w.WriteHeader(http.StatusOK)
}

func publishEvent(action string, a Agent) {
	_ = bus.Publish(eventPrefix+"."+action, map[string]any{"action": action, "agent": a})
}

func auth(r *http.Request) error {
	if jwks != nil {
		token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		if token == "" {
			return errors.New("missing token")
		}
		if _, err := jwt.Parse(token, jwks.Keyfunc); err != nil {
			return err
		}
		return nil
	}
	if apiKey != "" {
		if r.Header.Get("X-API-Key") != apiKey {
			return errors.New("unauthorized")
		}
	}
	return nil
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
