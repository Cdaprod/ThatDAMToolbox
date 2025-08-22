package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/MicahParks/keyfunc"
)

var overlayKey = []byte("overlay-demo-key")

// signToken mimics api-gateway token issuance for tests.
func signToken(agentID string) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT","kid":"overlay"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"` + agentID + `"}`))
	h := hmac.New(sha256.New, overlayKey)
	h.Write([]byte(header + "." + payload))
	sig := base64.RawURLEncoding.EncodeToString(h.Sum(nil))
	return header + "." + payload + "." + sig
}

func TestOkHandler(t *testing.T) {
	jwksJSON := []byte(`{"keys":[{"kty":"oct","kid":"overlay","k":"` + base64.RawURLEncoding.EncodeToString(overlayKey) + `"}]}`)
	var err error
	jwks, err = keyfunc.NewJSON(jwksJSON)
	if err != nil {
		t.Fatalf("jwks: %v", err)
	}
	token := signToken("agent1")
	req := httptest.NewRequest(http.MethodPost, "/v1/register", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	okHandler(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
}
func TestHandlers(t *testing.T) {
	jwksJSON := []byte(`{"keys":[{"kty":"oct","kid":"overlay","k":"` + base64.RawURLEncoding.EncodeToString(overlayKey) + `"}]}`)
	var err error
	jwks, err = keyfunc.NewJSON(jwksJSON)
	if err != nil {
		t.Fatalf("jwks: %v", err)
	}
	token := signToken("agent1")

	tests := []struct {
		name    string
		handler http.HandlerFunc
		path    string
		body    string
	}{
		{"publish", publishHandler, "/v1/publish", `{"topic":"t","payload":"p"}`},
		{"subscribe", subscribeHandler, "/v1/subscribe", `{"topics":["t1"]}`},
		{"reroute", rerouteHandler, "/v1/reroute", `{"node_id":"n1","target":"n2"}`},
		{"telemetry", telemetryHandler, "/v1/telemetry", `{"node_id":"n1","cpu":1}`},
		{"nodeInit", nodeInitHandler, "/v1/node/init", `{"node_id":"n1"}`},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// valid token and body
			req := httptest.NewRequest(http.MethodPost, tt.path, strings.NewReader(tt.body))
			req.Header.Set("Authorization", "Bearer "+token)
			rr := httptest.NewRecorder()
			tt.handler(rr, req)
			if rr.Code != http.StatusOK {
				t.Fatalf("expected 200, got %d", rr.Code)
			}

			// bad json
			req = httptest.NewRequest(http.MethodPost, tt.path, strings.NewReader("{"))
			req.Header.Set("Authorization", "Bearer "+token)
			rr = httptest.NewRecorder()
			tt.handler(rr, req)
			if rr.Code != http.StatusBadRequest {
				t.Fatalf("expected 400, got %d", rr.Code)
			}

			// missing token
			req = httptest.NewRequest(http.MethodPost, tt.path, strings.NewReader(tt.body))
			rr = httptest.NewRecorder()
			tt.handler(rr, req)
			if rr.Code != http.StatusUnauthorized {
				t.Fatalf("expected 401, got %d", rr.Code)
			}
		})
	}

	req := httptest.NewRequest(http.MethodPost, "/v1/negotiate?class=realtime", nil)
	req.Header.Set("Authorization", "Bearer "+token)
	rr := httptest.NewRecorder()
	negotiateHandler(rr, req)
	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rr.Code)
	}
	var resp struct {
		Transport  string   `json:"transport"`
		Endpoints  []string `json:"endpoints"`
		ABRCeiling int      `json:"abr_ceiling"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&resp); err != nil {
		t.Fatalf("decode: %v", err)
	}
	if resp.ABRCeiling != 3000 {
		t.Fatalf("expected ceiling 3000, got %d", resp.ABRCeiling)
	}
	if resp.Transport != "quic" || len(resp.Endpoints) == 0 {
		t.Fatalf("unexpected resp: %+v", resp)
	}
}
