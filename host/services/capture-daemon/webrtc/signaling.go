package webrtc

import (
        "encoding/json"
        "net/http"
        "os"
        "strings"
        "sync"

        "github.com/pion/webrtc/v3"
)

type Session struct {
	PC    *webrtc.PeerConnection
	Track *webrtc.TrackLocalStaticSample
}

var (
        mu       sync.Mutex
        sessions = make(map[*webrtc.PeerConnection]*Session)
)

// iceServers returns ICE servers from the ICE_SERVERS environment variable
// as a comma-separated list of STUN/TURN URLs.
func iceServers() []webrtc.ICEServer {
        val := os.Getenv("ICE_SERVERS")
        if val == "" {
                return nil
        }
        parts := strings.Split(val, ",")
        servers := make([]webrtc.ICEServer, 0, len(parts))
        for _, p := range parts {
                p = strings.TrimSpace(p)
                if p == "" {
                        continue
                }
                servers = append(servers, webrtc.ICEServer{URLs: []string{p}})
        }
        return servers
}

// NewSession creates a PeerConnection and track for a client.
func NewSession() (*Session, error) {
        pc, err := webrtc.NewPeerConnection(webrtc.Configuration{ICEServers: iceServers()})
	if err != nil {
		return nil, err
	}
	track, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
		"video", "capture-daemon",
	)
	if err != nil {
		pc.Close()
		return nil, err
	}
	if _, err = pc.AddTrack(track); err != nil {
		pc.Close()
		return nil, err
	}
	s := &Session{PC: pc, Track: track}
	mu.Lock()
	sessions[pc] = s
	mu.Unlock()
	return s, nil
}

// Sessions returns all active sessions.
func Sessions() []*Session {
	mu.Lock()
	defer mu.Unlock()
	out := make([]*Session, 0, len(sessions))
	for _, s := range sessions {
		out = append(out, s)
	}
	return out
}

// RegisterRoutes wires up the WebRTC offer endpoint under prefix.
func RegisterRoutes(mux *http.ServeMux, prefix string) {
	mux.HandleFunc(prefix+"/offer", offerHandler)
}

func offerHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		SDP webrtc.SessionDescription `json:"sdp"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	sess, err := NewSession()
	if err != nil {
		http.Error(w, "init session", http.StatusInternalServerError)
		return
	}
	if err := sess.PC.SetRemoteDescription(req.SDP); err != nil {
		http.Error(w, "set remote", http.StatusInternalServerError)
		return
	}
	ans, err := sess.PC.CreateAnswer(nil)
	if err != nil {
		http.Error(w, "create answer", http.StatusInternalServerError)
		return
	}
	if err := sess.PC.SetLocalDescription(ans); err != nil {
		http.Error(w, "set local", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"sdp": ans})
}
