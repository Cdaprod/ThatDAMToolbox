package main

// overlay-hub exposes register and heartbeat endpoints and a QUIC relay stub.
//
// Example:
//   go run ./cmd/overlay-hub/main.go -addr :8090

import (
	"encoding/json"
	"errors"
	"flag"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc"
	"github.com/golang-jwt/jwt/v4"

	pathpkg "github.com/Cdaprod/ThatDamToolbox/host/services/overlay-hub/path"
	policypkg "github.com/Cdaprod/ThatDamToolbox/host/services/overlay-hub/policy"
)

var (
	jwks  *keyfunc.JWKS
	pol   = policypkg.New()
	paths = []pathpkg.Path{
		{Endpoint: "edge-a", LatencyMS: 30, CapacityKbps: 5000},
		{Endpoint: "edge-b", LatencyMS: 20, CapacityKbps: 7000},
	}
)

func main() {
	addr := flag.String("addr", ":8090", "HTTP bind address")
	jwksURL := flag.String("jwks-url", os.Getenv("JWKS_URL"), "JWKS endpoint URL")
	flag.Parse()

	if *jwksURL == "" {
		log.Fatal("JWKS_URL is required")
	}
	var err error
	jwks, err = keyfunc.Get(*jwksURL, keyfunc.Options{RefreshInterval: time.Minute})
	if err != nil {
		log.Fatalf("load jwks: %v", err)
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	mux.HandleFunc("/metrics", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	mux.HandleFunc("/v1/register", okHandler)
	mux.HandleFunc("/v1/heartbeat", okHandler)
	mux.HandleFunc("/v1/negotiate", negotiateHandler)

	srv := &http.Server{
		Addr:         *addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	log.Printf("overlay-hub listening on %s", *addr)
	log.Fatal(srv.ListenAndServe())
}

func authAgent(r *http.Request) (string, error) {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if token == "" {
		return "", errors.New("missing token")
	}
	if jwks == nil {
		return "", errors.New("jwks not loaded")
	}
	tkn, err := jwt.Parse(token, jwks.Keyfunc)
	if err != nil {
		return "", err
	}
	claims, ok := tkn.Claims.(jwt.MapClaims)
	if !ok || !tkn.Valid {
		return "", errors.New("invalid token")
	}
	sub, _ := claims["sub"].(string)
	if sub == "" {
		return "", errors.New("missing subject")
	}
	return sub, nil
}

func okHandler(w http.ResponseWriter, r *http.Request) {
	if _, err := authAgent(r); err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	w.WriteHeader(http.StatusOK)
}

// negotiateHandler returns a flow contract based on policy and path ranking.
//
// Example:
//
//	curl -H "Authorization: Bearer $TOKEN" \
//	     -X POST 'http://localhost:8090/v1/negotiate?class=realtime'
func negotiateHandler(w http.ResponseWriter, r *http.Request) {
	agentID, err := authAgent(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusUnauthorized)
		return
	}
	class := r.URL.Query().Get("class")
	if class == "" {
		class = "realtime"
	}
	ceiling, ok := pol.Check(agentID, class)
	if !ok {
		http.Error(w, "denied", http.StatusForbidden)
		return
	}
	ranked := pathpkg.Rank(paths)
	resp := struct {
		Transport  string   `json:"transport"`
		Endpoints  []string `json:"endpoints"`
		ABRCeiling int      `json:"abr_ceiling"`
	}{
		Transport:  "quic",
		Endpoints:  []string{ranked[0].Endpoint},
		ABRCeiling: ceiling,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}
