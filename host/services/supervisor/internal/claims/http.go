package claims

// HTTP handlers for the claim store.
//
// Example curl to create and fulfil a claim:
//
//  curl -X POST http://localhost:8070/api/claims/new
//  curl -X POST http://localhost:8070/api/claims/fulfill -d '{"id":"<id>","token":"<token>"}'
//
// Watchers may listen for fulfilment via Server-Sent Events:
//
//  curl http://localhost:8070/api/claims/<id>/watch
//
// All handlers expect authentication via the existing auth(r) helper.

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// AuthFunc matches the auth function from cmd/supervisor.
type AuthFunc func(*http.Request) (ports.Principal, error)

// Server bundles handlers with a Store and auth hook.
type Server struct {
	store *Store
	auth  AuthFunc
}

// NewServer constructs a claims server with the provided auth func.
func NewServer(auth AuthFunc) *Server {
	return &Server{store: NewStore(), auth: auth}
}

// HandleNew issues a new claim token.
// Example: curl -X POST http://localhost:8070/api/claims/new
func (s *Server) HandleNew(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if _, err := s.auth(r); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	id, token := s.store.New()
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"id": id, "token": token})
}

// HandleWatch streams fulfilment updates via SSE.
// Example: curl http://localhost:8070/api/claims/<id>/watch
func (s *Server) HandleWatch(w http.ResponseWriter, r *http.Request) {
	if _, err := s.auth(r); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/api/claims/"), "/")
	if len(parts) != 2 || parts[0] == "" || parts[1] != "watch" {
		http.NotFound(w, r)
		return
	}
	id := parts[0]
	ch, ok := s.store.Watch(id)
	if !ok {
		http.NotFound(w, r)
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "stream unsupported", http.StatusInternalServerError)
		return
	}
	ticker := time.NewTicker(15 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ch:
			w.Write([]byte("data: fulfilled\n\n"))
			flusher.Flush()
			return
		case <-ticker.C:
			w.Write([]byte(": heartbeat\n\n"))
			flusher.Flush()
		case <-r.Context().Done():
			return
		}
	}
}

// HandleFulfill marks a claim fulfilled given an ID and token.
// Example: curl -X POST http://localhost:8070/api/claims/fulfill -d '{"id":"<id>","token":"<token>"}'
func (s *Server) HandleFulfill(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if _, err := s.auth(r); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	var req struct {
		ID    string `json:"id"`
		Token string `json:"token"`
	}
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(&req); err != nil || req.ID == "" || req.Token == "" {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if ok := s.store.Fulfill(req.ID, req.Token); !ok {
		http.Error(w, "invalid claim", http.StatusNotFound)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ErrUnauthorized is returned when auth fails.
var ErrUnauthorized = errors.New("unauthorized")
