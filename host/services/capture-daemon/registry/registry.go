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

// Device represents the minimal info stored for each discovered device.
type Device = scanner.Device // re-export for convenience

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

// ---------------- public helpers ----------------

// Update merges a freshly-scanned device list into the registry.
func (r *Registry) Update(devs []scanner.Device) {
	r.mu.Lock()
	defer r.mu.Unlock()

	seen := make(map[string]struct{})
	for _, d := range devs {
		seen[d.ID] = struct{}{}
		r.devices[d.ID] = d // refresh LastSeen etc.
	}

	for id := range r.devices {
		if _, ok := seen[id]; !ok {
			// device disappeared → stop its runner (if any) and forget it
			if cancel, has := r.stopFuncs[id]; has {
				cancel()
				delete(r.stopFuncs, id)
			}
			delete(r.devices, id)
		}
	}
}

// List returns a **copy** of the current devices map.
func (r *Registry) List() map[string]Device {
	r.mu.Lock()
	defer r.mu.Unlock()
	cp := make(map[string]Device, len(r.devices))
	for k, v := range r.devices {
		cp[k] = v
	}
	return cp
}

// HasRunner reports whether a cancel func is registered for id.
func (r *Registry) HasRunner(id string) bool {
	r.mu.Lock()
	defer r.mu.Unlock()
	_, ok := r.stopFuncs[id]
	return ok
}

// RegisterStopFunc stores a cancel func for this device.
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

// ---------------- tiny HTTP helper ----------------

// ServeAPI exposes GET /devices and returns any listen error.
func (r *Registry) ServeAPI(addr string) error {
	http.HandleFunc("/devices", func(w http.ResponseWriter, _ *http.Request) {
		r.mu.Lock()
		defer r.mu.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(r.devices)
	})
	return http.ListenAndServe(addr, nil)
}