package webrtc

import (
	"encoding/json"
	"net/http"

	"github.com/pion/webrtc/v3"
)

var (
	pc    *webrtc.PeerConnection
	track *webrtc.TrackLocalStaticSample
)

// InitAPI creates the PeerConnection and a single H264 track.
func InitAPI() error {
	p, err := webrtc.NewPeerConnection(webrtc.Configuration{})
	if err != nil {
		return err
	}
	pc = p

	t, err := webrtc.NewTrackLocalStaticSample(
		webrtc.RTPCodecCapability{MimeType: webrtc.MimeTypeH264},
		"video", "capture-daemon",
	)
	if err != nil {
		return err
	}
	if _, err = pc.AddTrack(t); err != nil {
		return err
	}
	track = t
	return nil
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
	if err := pc.SetRemoteDescription(req.SDP); err != nil {
		http.Error(w, "set remote", http.StatusInternalServerError)
		return
	}
	ans, err := pc.CreateAnswer(nil)
	if err != nil {
		http.Error(w, "create answer", http.StatusInternalServerError)
		return
	}
	if err := pc.SetLocalDescription(ans); err != nil {
		http.Error(w, "set local", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"sdp": ans})
}
