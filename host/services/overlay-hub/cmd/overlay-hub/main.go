package main

// overlay-hub exposes register and heartbeat endpoints and a QUIC relay stub.
//
// Example:
//   go run ./cmd/overlay-hub/main.go -addr :8090

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/MicahParks/keyfunc"
	"github.com/golang-jwt/jwt/v4"
)

var jwks *keyfunc.JWKS

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
	mux.HandleFunc("/v1/negotiate", okHandler)
	mux.HandleFunc("/v1/publish", publishHandler)
	mux.HandleFunc("/v1/subscribe", subscribeHandler)
	mux.HandleFunc("/v1/reroute", rerouteHandler)
	mux.HandleFunc("/v1/telemetry", telemetryHandler)
	mux.HandleFunc("/v1/node/init", nodeInitHandler)

	srv := &http.Server{
		Addr:         *addr,
		Handler:      mux,
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 5 * time.Second,
	}

	log.Printf("overlay-hub listening on %s", *addr)
	log.Fatal(srv.ListenAndServe())
}

func okHandler(w http.ResponseWriter, r *http.Request) {
	if !authorize(w, r) {
		return
	}
	w.WriteHeader(http.StatusOK)
}

func authorize(w http.ResponseWriter, r *http.Request) bool {
	token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if token == "" {
		http.Error(w, "missing token", http.StatusUnauthorized)
		return false
	}
	if jwks == nil {
		http.Error(w, "jwks not loaded", http.StatusInternalServerError)
		return false
	}
	if _, err := jwt.Parse(token, jwks.Keyfunc); err != nil {
		http.Error(w, "invalid token", http.StatusUnauthorized)
		return false
	}
	return true
}

func publishHandler(w http.ResponseWriter, r *http.Request) {
	if !authorize(w, r) {
		return
	}
	var req PublishRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	writeJSON(w, PublishResponse{Status: "ok"})
}

func subscribeHandler(w http.ResponseWriter, r *http.Request) {
	if !authorize(w, r) {
		return
	}
	var req SubscribeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	writeJSON(w, SubscribeResponse{Status: "ok"})
}

func rerouteHandler(w http.ResponseWriter, r *http.Request) {
	if !authorize(w, r) {
		return
	}
	var req RerouteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	writeJSON(w, RerouteResponse{Status: "ok"})
}

func telemetryHandler(w http.ResponseWriter, r *http.Request) {
	if !authorize(w, r) {
		return
	}
	var req TelemetryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	writeJSON(w, TelemetryResponse{Status: "ok"})
}

func nodeInitHandler(w http.ResponseWriter, r *http.Request) {
	if !authorize(w, r) {
		return
	}
	var req NodeInitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	writeJSON(w, NodeInitResponse{Status: "ok"})
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

type PublishRequest struct {
	Topic   string `json:"topic"`
	Payload string `json:"payload"`
}

type PublishResponse struct {
	Status string `json:"status"`
}

type SubscribeRequest struct {
	Topics []string `json:"topics"`
}

type SubscribeResponse struct {
	Status string `json:"status"`
}

type RerouteRequest struct {
	NodeID string `json:"node_id"`
	Target string `json:"target"`
}

type RerouteResponse struct {
	Status string `json:"status"`
}

type TelemetryRequest struct {
	NodeID string  `json:"node_id"`
	CPU    float64 `json:"cpu"`
}

type TelemetryResponse struct {
	Status string `json:"status"`
}

type NodeInitRequest struct {
	NodeID string `json:"node_id"`
}

type NodeInitResponse struct {
	Status string `json:"status"`
}
