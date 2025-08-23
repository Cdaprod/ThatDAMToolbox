package authz

import (
	"crypto/rand"
	"crypto/rsa"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/lestrrat-go/jwx/v2/jwk"
)

// TestWithAuth validates that a token signed by the JWKS key is accepted.
func TestWithAuth(t *testing.T) {
	// generate key and JWKS server
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	jw, _ := jwk.FromRaw(&key.PublicKey)
	_ = jw.Set(jwk.KeyIDKey, "k1")
	_ = jw.Set(jwk.AlgorithmKey, "RS256")
	set := jwk.NewSet()
	_ = set.AddKey(jw)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		b, _ := json.Marshal(set)
		w.Write(b)
	}))
	defer srv.Close()

	if err := InitJWKS(srv.URL); err != nil {
		t.Fatalf("init jwks: %v", err)
	}

	// sign token
	token := jwt.NewWithClaims(jwt.SigningMethodRS256, &Claims{
		Typ:      "pat",
		TenantID: "t1",
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:  "user_1",
			Issuer:   "https://auth.thatdamtoolbox.cloud",
			Audience: jwt.ClaimStrings{"thatdamtoolbox"},
		},
	})
	token.Header["kid"] = "k1"
	signed, err := token.SignedString(key)
	if err != nil {
		t.Fatalf("sign: %v", err)
	}

	kf, err := Keyfunc()
	if err != nil {
		t.Fatalf("keyfunc: %v", err)
	}
	if _, err := jwt.ParseWithClaims(signed, &Claims{}, kf, jwt.WithIssuer("https://auth.thatdamtoolbox.cloud"), jwt.WithAudience("thatdamtoolbox")); err != nil {
		t.Fatalf("parse: %v", err)
	}

	called := false
	h := WithAuth(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Authorization", "Bearer "+signed)
	w := httptest.NewRecorder()
	h.ServeHTTP(w, req)
	if !called || w.Code != http.StatusOK {
		t.Fatalf("middleware blocked: %d", w.Code)
	}
}
