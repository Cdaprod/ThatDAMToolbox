package http

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/api-gateway/internal/tokens"
	authz "github.com/Cdaprod/ThatDamToolbox/host/shared/authz"
)

// TestJWKSHandler ensures JWKS handler returns valid JSON.
func TestJWKSHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/.well-known/jwks.json", nil)
	w := httptest.NewRecorder()
	JWKSHandler(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("unexpected status %d", w.Code)
	}
	var v map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &v); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
}

// TestSessionExchange issues a PAT when X-User-ID header is present.
func TestSessionExchange(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/auth/session/exchange", nil)
	req.Header.Set("X-User-ID", "dev")
	w := httptest.NewRecorder()
	SessionExchangeHandler(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
	var body map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("invalid json: %v", err)
	}
	if body["access_token"] == "" {
		t.Fatalf("missing token")
	}
}

// TestAssetsHandler validates RS256 token parsing via JWKS.
func TestAssetsHandler(t *testing.T) {
	// Start JWKS server
	jwksSrv := httptest.NewServer(http.HandlerFunc(JWKSHandler))
	defer jwksSrv.Close()
	if err := authz.InitJWKS(jwksSrv.URL); err != nil {
		t.Fatalf("init jwks: %v", err)
	}
	// Sign token using same key
	tok, err := tokens.SignPAT("user_1", "t1", nil, nil)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}
	req := httptest.NewRequest(http.MethodGet, "/assets", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	w := httptest.NewRecorder()
	authz.WithAuth(http.HandlerFunc(AssetsHandler)).ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("status %d", w.Code)
	}
}
