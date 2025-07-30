// /host/services/capture-daemon/registry/registry.go
package registry

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner"
)

// Device is an alias to scanner.Device so callers don’t need to import both
type Device = scanner.Device

// Registry tracks devices and their cancellation callbacks.
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
	http.HandleFunc("/devices", func(w http.ResponseWriter, _ *http.Request) {
		r.mu.Lock()
		defer r.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(r.devices)
	})
	log.Printf("🌐 registry API listening on %s", addr)
	return http.ListenAndServe(addr, nil)
}