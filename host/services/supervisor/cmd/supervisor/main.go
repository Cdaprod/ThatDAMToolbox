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
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/bus"
	busamqp "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bus/amqp"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	envpolicy "github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/policy/envpolicy"
	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
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
	policy      ports.Policy
	reg         *Registry
	apiKey      string
	jwks        *keyfunc.JWKS
	eventPrefix string
	busEnabled  bool
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
	policy = envpolicy.NewFromEnv()
	reg = NewRegistry()

	if *jwksURL != "" {
		var err error
		jwks, err = keyfunc.Get(*jwksURL, keyfunc.Options{RefreshInterval: time.Minute})
		if err != nil {
			logx.L.Error("load jwks", "err", err)
			os.Exit(1)
		}
	}

	if strings.EqualFold(os.Getenv("BUS_KIND"), "amqp") {
		busamqp.Register()
	}
	if _, err := bus.Connect(context.Background(), bus.Config{}); err != nil {
		logx.L.Warn("event bus disabled", "err", err)
	} else {
		busEnabled = true
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
		Addr:              *addr,
		Handler:           withSafety(mux),
		ReadTimeout:       5 * time.Second,
		ReadHeaderTimeout: 3 * time.Second,
		WriteTimeout:      5 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	logx.L.Info("supervisor listening", "addr", *addr)
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			logx.L.Error("server failed", "err", err)
		}
	}()
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		logx.L.Error("graceful shutdown failed", "err", err)
	}
	logx.L.Info("supervisor stopped")
}

func agentsHandler(w http.ResponseWriter, r *http.Request) {
	snap := reg.Snapshot()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(snap)
}

func registerHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if _, err := auth(r); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	var a Agent
	if err := decodeStrict(r, &a); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	a.Status = "registered"
	a.LastHeartbeat = time.Now()
	reg.Upsert(a)
	publishEvent("register", a)
	w.WriteHeader(http.StatusOK)
	logx.L.Info("register", "id", a.ID)
}

func heartbeatHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if _, err := auth(r); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	var payload struct {
		ID   string         `json:"id"`
		Meta map[string]any `json:"meta,omitempty"`
	}
	if err := decodeStrict(r, &payload); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	reg.Heartbeat(payload.ID, payload.Meta)
	publishEvent("heartbeat", Agent{ID: payload.ID})
	w.WriteHeader(http.StatusOK)
	logx.L.Info("heartbeat", "id", payload.ID)
}

func publishEvent(action string, a Agent) {
	if !busEnabled {
		return
	}
	_ = bus.Publish(eventPrefix+"."+action, map[string]any{"action": action, "agent": a})
}

func auth(r *http.Request) (ports.Principal, error) {
	var p ports.Principal
	if jwks != nil {
		raw := strings.TrimSpace(strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer "))
		if raw == "" {
			return p, nil
		}
		token, err := jwt.Parse(raw, jwks.Keyfunc)
		if err != nil || !token.Valid {
			if err == nil {
				err = errors.New("invalid token")
			}
			return p, err
		}
		if claims, ok := token.Claims.(jwt.MapClaims); ok {
			if aud := os.Getenv("JWT_AUD"); aud != "" && !claims.VerifyAudience(aud, true) {
				return p, errors.New("invalid audience")
			}
			if iss := os.Getenv("JWT_ISS"); iss != "" && !claims.VerifyIssuer(iss, true) {
				return p, errors.New("invalid issuer")
			}
			if sub, ok := claims["sub"].(string); ok {
				p.Sub = sub
			}
			if scope, ok := claims["scope"].(string); ok {
				p.Scopes = make(map[string]bool)
				for _, s := range strings.Fields(scope) {
					p.Scopes[s] = true
				}
			}
		}
		if alg := token.Method.Alg(); alg != "RS256" && alg != "ES256" {
			return p, errors.New("invalid algorithm")
		}
		return p, nil
	}
	if apiKey != "" {
		if r.Header.Get("X-API-Key") != apiKey {
			return p, errors.New("unauthorized")
		}
		p.Sub = "apikey"
		p.Scopes = map[string]bool{
			"thatdam:register": true,
			"thatdam:read":     true,
			"thatdam:apply":    true,
			"thatdam:admin":    true,
		}
	}
	return p, nil
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// withSafety adds simple hardening: method guards, body size limits, and request logging.
func withSafety(next *http.ServeMux) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
		start := time.Now()
		next.ServeHTTP(w, r)
		logx.L.Debug("http", "method", r.Method, "path", r.URL.Path, "dur_ms", time.Since(start).Milliseconds())
	})
}

func decodeStrict(r *http.Request, dst any) error {
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}
