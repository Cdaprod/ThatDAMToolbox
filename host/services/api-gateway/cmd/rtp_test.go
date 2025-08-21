package main

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestRegisterAndFetchSDP(t *testing.T) {
	mux := http.NewServeMux()
	setupRTPRoutes(mux)
	srv := httptest.NewServer(mux)
	defer srv.Close()

	body := `{"id":"s1","address":"239.0.0.1","port":5004,"payload_type":96,"clock_rate":90000}`
	resp, err := http.Post(srv.URL+"/rtp/sessions", "application/json", strings.NewReader(body))
	if err != nil {
		t.Fatalf("post: %v", err)
	}
	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("status = %d", resp.StatusCode)
	}

	res, err := http.Get(srv.URL + "/rtp/sessions/s1.sdp")
	if err != nil {
		t.Fatalf("get: %v", err)
	}
	b, _ := io.ReadAll(res.Body)
	if !strings.Contains(string(b), "m=video 5004") {
		t.Fatalf("unexpected sdp: %s", string(b))
	}
}
