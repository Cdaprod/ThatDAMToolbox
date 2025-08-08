package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

var overlayKey = []byte("overlay-demo-key")

func setupOverlayRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/.well-known/jwks.json", jwksHandler)
	mux.HandleFunc("/agents/issue", issueHandler)
	mux.HandleFunc("/overlay/hints", hintsHandler)
}

func jwksHandler(w http.ResponseWriter, r *http.Request) {
	jwk := map[string]any{
		"kty": "oct",
		"kid": "overlay",
		"k":   base64.RawURLEncoding.EncodeToString(overlayKey),
		"alg": "HS256",
	}
	json.NewEncoder(w).Encode(map[string]any{"keys": []any{jwk}})
}

func issueHandler(w http.ResponseWriter, r *http.Request) {
	var req struct {
		AgentID string `json:"agent_id"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	token := signToken(req.AgentID)
	json.NewEncoder(w).Encode(map[string]string{"token": token})
}

func hintsHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]any{"primary": "http://overlay-hub:8090"})
}

func signToken(agentID string) string {
	header := base64.RawURLEncoding.EncodeToString([]byte(`{"alg":"HS256","typ":"JWT"}`))
	payload := base64.RawURLEncoding.EncodeToString([]byte(`{"sub":"` + agentID + `","exp":` + fmt.Sprint(time.Now().Add(time.Minute).Unix()) + `}`))
	h := hmac.New(sha256.New, overlayKey)
	h.Write([]byte(header + "." + payload))
	sig := base64.RawURLEncoding.EncodeToString(h.Sum(nil))
	return header + "." + payload + "." + sig
}
