package main

// overlay-hub exposes register and heartbeat endpoints and a QUIC relay stub.
//
// Example:
//   go run ./cmd/overlay-hub/main.go -addr :8090

import (
	"flag"
	"log"
	"net/http"
	"time"
)

func main() {
	addr := flag.String("addr", ":8090", "HTTP bind address")
	flag.Parse()

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
	w.WriteHeader(http.StatusOK)
}
