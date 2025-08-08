package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/MicahParks/keyfunc"
)

var overlayKey = []byte("overlay-demo-key")

// signToken mimics api-gateway token issuance for tests.
func signToken(agentID string) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
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
	w := httptest.NewRecorder()
	okHandler(w, req)
	if w.Result().StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Result().StatusCode)
	}
}
