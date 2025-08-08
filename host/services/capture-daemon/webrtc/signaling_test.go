package webrtc

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/pion/webrtc/v3"
)

// TestOfferCreatesSessions ensures each offer gets its own track.
func TestOfferCreatesSessions(t *testing.T) {
	mux := http.NewServeMux()
	RegisterRoutes(mux, "/webrtc")
	srv := httptest.NewServer(mux)
	defer srv.Close()

	sendOffer := func() {
		pc, err := webrtc.NewPeerConnection(webrtc.Configuration{})
		if err != nil {
			t.Fatalf("peer connection: %v", err)
		}
		defer pc.Close()
		offer, err := pc.CreateOffer(nil)
		if err != nil {
			t.Fatalf("create offer: %v", err)
		}
		if err := pc.SetLocalDescription(offer); err != nil {
			t.Fatalf("set local: %v", err)
		}
		buf := new(bytes.Buffer)
		_ = json.NewEncoder(buf).Encode(map[string]any{"sdp": offer})
		resp, err := http.Post(srv.URL+"/webrtc/offer", "application/json", buf)
		if err != nil {
			t.Fatalf("post offer: %v", err)
		}
		if resp.StatusCode != http.StatusOK {
			t.Fatalf("expected 200, got %d", resp.StatusCode)
		}
	}

	sendOffer()
	sendOffer()

	sessions := Sessions()
	if len(sessions) != 2 {
		t.Fatalf("expected 2 sessions, got %d", len(sessions))
	}
	if sessions[0].Track == sessions[1].Track {
		t.Fatalf("tracks should be independent")
	}
}
