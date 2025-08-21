// /host/services/api-gateway/cmd/streams.go
// Stream registry and WebRTC signaling handlers.
// Example usage:
//
//	curl -H "Authorization: Bearer TOKEN" -X POST \
//	  -d '{"id":"cam1","codecs":["h264"],"transports":["webrtc"]}' \
//	  http://localhost:8080/streams
package main

import (
	"encoding/json"
	"net/http"
	"strings"
	"sync"
)

type Stream struct {
	ID         string   `json:"id"`
	Codecs     []string `json:"codecs"`
	Transports []string `json:"transports"`
	Offer      string   `json:"offer,omitempty"`
	Answer     string   `json:"answer,omitempty"`
	ICE        []string `json:"ice,omitempty"`
}

var (
	streams   = make(map[string]*Stream)
	streamsMu sync.RWMutex
)

func setupStreamRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/streams", streamsHandler)
	mux.HandleFunc("/streams/", streamHandler)
}

// streamsHandler handles collection routes for /streams
func streamsHandler(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		streamsMu.RLock()
		list := make([]*Stream, 0, len(streams))
		for _, s := range streams {
			list = append(list, s)
		}
		streamsMu.RUnlock()
		writeJSON(w, list, http.StatusOK)
	case http.MethodPost:
		var s Stream
		if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		if s.ID == "" {
			http.Error(w, "id required", http.StatusBadRequest)
			return
		}
		streamsMu.Lock()
		streams[s.ID] = &s
		streamsMu.Unlock()
		writeJSON(w, s, http.StatusCreated)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// streamHandler handles item routes for /streams/{id}
func streamHandler(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/streams/")
	parts := strings.Split(path, "/")
	if len(parts) == 0 || parts[0] == "" {
		http.NotFound(w, r)
		return
	}
	id := parts[0]

	streamsMu.Lock()
	s, ok := streams[id]
	if !ok {
		if r.Method == http.MethodPost || r.Method == http.MethodPut {
			s = &Stream{ID: id}
			streams[id] = s
		} else {
			streamsMu.Unlock()
			http.NotFound(w, r)
			return
		}
	}
	streamsMu.Unlock()

	if len(parts) == 1 {
		switch r.Method {
		case http.MethodGet:
			writeJSON(w, s, http.StatusOK)
		case http.MethodPut:
			var upd Stream
			if err := json.NewDecoder(r.Body).Decode(&upd); err != nil {
				http.Error(w, "invalid json", http.StatusBadRequest)
				return
			}
			streamsMu.Lock()
			s.Codecs = upd.Codecs
			s.Transports = upd.Transports
			streamsMu.Unlock()
			writeJSON(w, s, http.StatusOK)
		case http.MethodDelete:
			streamsMu.Lock()
			delete(streams, id)
			streamsMu.Unlock()
			w.WriteHeader(http.StatusNoContent)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	// signaling subpaths
	switch parts[1] {
	case "offer":
		signalingHandler(w, r, &s.Offer)
	case "answer":
		signalingHandler(w, r, &s.Answer)
	case "ice":
		iceHandler(w, r, s)
	default:
		http.NotFound(w, r)
	}
}

// signalingHandler stores or retrieves SDP strings
func signalingHandler(w http.ResponseWriter, r *http.Request, field *string) {
	switch r.Method {
	case http.MethodPost:
		var req struct {
			SDP string `json:"sdp"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		*field = req.SDP
		w.WriteHeader(http.StatusOK)
	case http.MethodGet:
		if *field == "" {
			http.NotFound(w, r)
			return
		}
		writeJSON(w, map[string]string{"sdp": *field}, http.StatusOK)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

// iceHandler proxies ICE candidates
func iceHandler(w http.ResponseWriter, r *http.Request, s *Stream) {
	switch r.Method {
	case http.MethodPost:
		var req struct {
			Candidate string `json:"candidate"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		streamsMu.Lock()
		s.ICE = append(s.ICE, req.Candidate)
		streamsMu.Unlock()
		w.WriteHeader(http.StatusOK)
	case http.MethodGet:
		writeJSON(w, map[string][]string{"candidates": s.ICE}, http.StatusOK)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func writeJSON(w http.ResponseWriter, v any, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
