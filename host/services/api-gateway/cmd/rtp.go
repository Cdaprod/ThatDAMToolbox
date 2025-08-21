// RTP session registry exposes SDP descriptors via HTTP.
//
// Example:
//
//	curl -X POST localhost:8080/rtp/sessions \
//	     -d '{"id":"cam1","address":"239.0.0.1","port":5004,"payload_type":96,"clock_rate":90000}'
//	curl localhost:8080/rtp/sessions/cam1.sdp
package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
)

type rtpSession struct {
	ID        string `json:"id"`
	Address   string `json:"address"`
	Port      int    `json:"port"`
	Payload   int    `json:"payload_type"`
	ClockRate int    `json:"clock_rate"`
}

var rtpSessions = struct {
	sync.RWMutex
	m map[string]rtpSession
}{m: make(map[string]rtpSession)}

func setupRTPRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/rtp/sessions", registerSessionHandler)
	mux.HandleFunc("/rtp/sessions/", sdpHandler)
}

func registerSessionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	var s rtpSession
	if err := json.NewDecoder(r.Body).Decode(&s); err != nil {
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte("invalid body"))
		return
	}
	rtpSessions.Lock()
	rtpSessions.m[s.ID] = s
	rtpSessions.Unlock()
	w.WriteHeader(http.StatusCreated)
}

func sdpHandler(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimSuffix(strings.TrimPrefix(r.URL.Path, "/rtp/sessions/"), ".sdp")
	rtpSessions.RLock()
	s, ok := rtpSessions.m[id]
	rtpSessions.RUnlock()
	if !ok {
		http.NotFound(w, r)
		return
	}
	fmt.Fprintf(w, "v=0\n"+
		"o=- 0 0 IN IP4 0.0.0.0\n"+
		"s=%s\n"+
		"c=IN IP4 %s\n"+
		"t=0 0\n"+
		"m=video %d RTP/AVP %d\n"+
		"a=rtpmap:%d raw/%d\n", s.ID, s.Address, s.Port, s.Payload, s.Payload, s.ClockRate)
}
