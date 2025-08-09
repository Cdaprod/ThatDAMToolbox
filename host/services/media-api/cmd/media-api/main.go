// /host/services/media-api/cmd/media-api/main.go
// Command-line entry for the Go media API.
// Example:
//
//	go run ./cmd/media-api --help
package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/Cdaprod/ThatDamToolbox/host/services/media-api/pkg/handlers"
)

func main() {
	if len(os.Args) < 2 {
		fmt.Fprintln(os.Stderr, "expected 'serve' subcommand")
		os.Exit(1)
	}

	switch os.Args[1] {
	case "serve":
		serve(os.Args[2:])
	default:
		fmt.Fprintln(os.Stderr, "unknown subcommand")
		os.Exit(1)
	}
}

// serve starts the HTTP server.
func serve(args []string) {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	addr := fs.String("addr", ":8080", "HTTP bind address")
	fs.Parse(args)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v2/health", handlers.Health)
	srv := &http.Server{Addr: *addr, Handler: mux}

	go func() {
		sig := make(chan os.Signal, 1)
		signal.Notify(sig, syscall.SIGINT, syscall.SIGTERM)
		<-sig
		_ = srv.Close()
	}()

	log.Printf("media-api listening on %s", *addr)
	if err := srv.ListenAndServe(); err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
