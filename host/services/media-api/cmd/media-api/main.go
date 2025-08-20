// /host/services/media-api/cmd/media-api/main.go
// Command-line entry for the Go media API.
// Example:
//
//	go run ./cmd/media-api --help
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sort"
	"strings"
	"sync"
	"syscall"

	"github.com/Cdaprod/ThatDamToolbox/host/services/media-api/pkg/config"
	"github.com/Cdaprod/ThatDamToolbox/host/services/media-api/pkg/handlers"
	"github.com/Cdaprod/ThatDamToolbox/host/services/media-api/pkg/indexer"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/storage"
	"github.com/Cdaprod/ThatDamToolbox/host/shared/platform"
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
	scan := fs.Bool("scan", false, "scan configured roots before serving")
	fs.Parse(args)

	de := platform.NewOSDirEnsurer()
	roots, err := config.GetScanRoots(de)
	if err != nil {
		log.Fatalf("config: %v", err)
	}
	rootDir := roots[0]
	deps := handlers.Deps{Cat: newMemCatalog(), BS: storage.NewFS(rootDir, de)}
	if *scan {
		if err := indexer.Scan(context.Background(), roots, deps.Cat); err != nil {
			log.Printf("scan: %v", err)
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/v2/health", handlers.Health)
	mux.HandleFunc("GET /v1/folders", deps.ListFolders)
	mux.HandleFunc("GET /v1/assets", deps.ListAssets)
	mux.HandleFunc("GET /v1/assets/{id}", deps.GetAsset)
	mux.HandleFunc("GET /v1/bytes", deps.Bytes)
	mux.HandleFunc("POST /v1/catalog/upsert", deps.UpsertAsset)
	if os.Getenv("PREVIEW_WORKER") == "1" {
		go func() {
			if err := handlers.StartPreviewWorker(context.Background(), storage.NewFS(rootDir, de), deps.Cat); err != nil {
				log.Printf("preview worker: %v", err)
			} else {
				log.Printf("preview worker started")
			}
		}()
	}
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

// memCatalog is a minimal in-memory catalog used for development.
type memCatalog struct {
	mu       sync.RWMutex
	byID     map[string]catalog.Asset
	byFolder map[string][]string
}

func newMemCatalog() *memCatalog {
	return &memCatalog{byID: make(map[string]catalog.Asset), byFolder: make(map[string][]string)}
}

func (m *memCatalog) Upsert(a catalog.Asset) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if old, ok := m.byID[a.ID]; ok && old.Folder != a.Folder {
		ids := m.byFolder[old.Folder]
		for i, id := range ids {
			if id == old.ID {
				m.byFolder[old.Folder] = append(ids[:i], ids[i+1:]...)
				break
			}
		}
	}
	m.byID[a.ID] = a
	list := m.byFolder[a.Folder]
	found := false
	for _, id := range list {
		if id == a.ID {
			found = true
			break
		}
	}
	if !found {
		list = append(list, a.ID)
	}
	m.byFolder[a.Folder] = list
	return nil
}

func (m *memCatalog) GetByID(id string) (catalog.Asset, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	a, ok := m.byID[id]
	return a, ok
}

func (m *memCatalog) ListByFolder(folder string, page, size int) ([]catalog.Asset, int) {
	if page < 1 {
		page = 1
	}
	if size < 1 {
		size = 50
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	ids := m.byFolder[folder]
	total := len(ids)
	start := (page - 1) * size
	if start >= total {
		return nil, total
	}
	end := start + size
	if end > total {
		end = total
	}
	out := make([]catalog.Asset, 0, end-start)
	for _, id := range ids[start:end] {
		out = append(out, m.byID[id])
	}
	return out, total
}

func (m *memCatalog) ListFolders(prefix string) []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []string
	for f := range m.byFolder {
		if prefix == "" || strings.HasPrefix(f, prefix) {
			out = append(out, f)
		}
	}
	sort.Strings(out)
	return out
}

func (m *memCatalog) Delete(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	a, ok := m.byID[id]
	if !ok {
		return nil
	}
	delete(m.byID, id)
	ids := m.byFolder[a.Folder]
	for i, v := range ids {
		if v == id {
			m.byFolder[a.Folder] = append(ids[:i], ids[i+1:]...)
			break
		}
	}
	return nil
}

var _ catalog.Catalog = (*memCatalog)(nil)
