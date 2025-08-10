// /host/services/capture-daemon/registry/registry.go
package registry

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner"
)

// Device is an alias to scanner.Device so callers don’t need to import both
type Device = scanner.Device

// Registry tracks devices (local or network) and their cancellation callbacks.
type Registry struct {
	mu        sync.Mutex
	devices   map[string]Device
	stopFuncs map[string]context.CancelFunc
}

// NewRegistry creates an empty registry.
func NewRegistry() *Registry {
	return &Registry{
		devices:   make(map[string]Device),
		stopFuncs: make(map[string]context.CancelFunc),
	}
}

// --------------------------------------------------
// Public helpers
// --------------------------------------------------

// Update merges a freshly-scanned device list into the registry and logs changes.
func (r *Registry) Update(devs []scanner.Device) {
	r.mu.Lock()
	defer r.mu.Unlock()

	seen := make(map[string]struct{})
	for _, d := range devs {
		seen[d.ID] = struct{}{}

		// refresh LastSeen so callers always get a recent timestamp
		d.LastSeen = time.Now()
		if _, exists := r.devices[d.ID]; !exists {
			log.Printf("➕ new device: %s (%s)", d.ID, d.Name)
		}
		r.devices[d.ID] = d
	}

	// detect disappearances
	for id := range r.devices {
		if _, stillThere := seen[id]; !stillThere {
			log.Printf("➖ device removed: %s", id)
			if cancel, ok := r.stopFuncs[id]; ok {
				cancel()
				delete(r.stopFuncs, id)
			}
			delete(r.devices, id)
		}
	}
}

// List returns a snapshot copy of the registry’s devices map.
func (r *Registry) List() map[string]Device {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := make(map[string]Device, len(r.devices))
	for k, v := range r.devices {
		cp[k] = v
	}
	return cp
}

// HasRunner reports whether we’ve registered a cancel func for id.
func (r *Registry) HasRunner(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, ok := r.stopFuncs[id]
	return ok
}

// RegisterStopFunc stores the cancel func for a running capture loop.
func (r *Registry) RegisterStopFunc(id string, cancel context.CancelFunc) {
	r.mu.Lock()
	r.stopFuncs[id] = cancel
	r.mu.Unlock()
}

// StopAll cancels every running capture loop.
func (r *Registry) StopAll() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for id, cancel := range r.stopFuncs {
		cancel()
		delete(r.stopFuncs, id)
	}
}

// --------------------------------------------------
// Tiny HTTP helper
// --------------------------------------------------

// ServeAPI exposes GET /devices on the given address and blocks.
func (r *Registry) ServeAPI(addr string) error {
	// redirect bare "/" to /devices
	http.HandleFunc("/", func(w http.ResponseWriter, req *http.Request) {
		if req.URL.Path == "/" { // only root--not other unknown paths
			http.Redirect(w, req, "/devices", http.StatusFound)
			return
		}
		http.NotFound(w, req)
	})

	// main handler
	http.HandleFunc("/devices", func(w http.ResponseWriter, req *http.Request) {
		r.mu.Lock()
		empty := len(r.devices) == 0
		snapshot := make(map[string]Device, len(r.devices))
		for k, v := range r.devices {
			snapshot[k] = v
		}
		r.mu.Unlock()

		// Serve meme if browser (+ empty registry)
		if empty && strings.Contains(req.Header.Get("Accept"), "text/html") {
			w.Header().Set("Content-Type", "text/html")
			_, _ = w.Write([]byte(noDevicesHTML))
			return
		}

		// Otherwise JSON
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(snapshot)
	})

	log.Printf("🌐 registry API listening on %s", addr)
	return http.ListenAndServe(addr, nil)
}

// Inline "no devices" HTML page with Kermit-shrug GIF
const noDevicesHTML = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8">
<title>No Cameras Detected</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
body{font-family:system-ui,Roboto,Helvetica,Arial,sans-serif;
display:flex;flex-direction:column;align-items:center;justify-content:center;
height:100vh;margin:0;background:#fafafa;color:#444;text-align:center}
h1{font-size:2rem;margin:1rem}
img{max-width:260px;height:auto}
</style>
</head><body>
<h1>Oops—your devices are on a coffee break!</h1>
<img src="https://gifdb.com/images/high/kermit-shrug-i-don-t-know-7m8kdymv037lcqm3.webp"
     alt="Kermit shrugging">
</body></html>`
