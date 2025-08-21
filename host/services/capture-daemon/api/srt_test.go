package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

// TestRegisterSRTRoutes negotiates SRT URLs.
func TestRegisterSRTRoutes(t *testing.T) {
	mux := http.NewServeMux()
	RegisterSRTRoutes(mux, "srt://localhost:9000")
	srv := httptest.NewServer(mux)
	defer srv.Close()
	resp, err := http.Get(srv.URL + "/srt?device=cam1")
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	var out map[string]string
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if out["uri"] != "srt://localhost:9000?streamid=cam1" {
		t.Fatalf("unexpected uri: %s", out["uri"])
	}
}
