// /host/services/capture-daemon/registry/registry.go
package registry

import (
    "encoding/json"
    "log"
    "net/http"
    "sync"
    "time"

    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner"
    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/runner"
)

// Device represents the minimal info stored for each discovered device.
type Device struct {
    ID       string                 `json:"id"`
    Name     string                 `json:"name"`
    LastSeen time.Time              `json:"last_seen"`
    Metadata map[string]interface{} `json:"metadata,omitempty"`
}

// Registry tracks devices and their associated runner goroutines.
type Registry struct {
    mu      sync.Mutex
    devices map[string]Device
    runners map[string]runner.RunnerControl
}

// NewRegistry creates an empty registry.
func NewRegistry() *Registry {
    return &Registry{
        devices: make(map[string]Device),
        runners: make(map[string]runner.RunnerControl),
    }
}

// Update scans for devices, starts runners for new ones, stops removed ones.
func (r *Registry) Update() {
    scanned, err := scanner.ScanAll()
    if err != nil {
        log.Printf("⚠️  scan error: %v", err)
        return
    }

    r.mu.Lock()
    defer r.mu.Unlock()

    seen := make(map[string]struct{})

    // Start runners for newly discovered devices
    for _, d := range scanned {
        seen[d.ID] = struct{}{}
        if _, ok := r.devices[d.ID]; !ok {
            log.Printf("➕ Device discovered: %s (%s)", d.ID, d.Name)
            ctl := runner.StartRunner(d.ID)
            r.runners[d.ID] = ctl
        }
        r.devices[d.ID] = Device{
            ID:       d.ID,
            Name:     d.Name,
            LastSeen: time.Now(),
        }
    }

    // Stop runners for devices no longer present
    for id := range r.devices {
        if _, stillThere := seen[id]; !stillThere {
            log.Printf("➖ Device removed: %s", id)
            if ctl, has := r.runners[id]; has {
                close(ctl.StopChan)
                delete(r.runners, id)
            }
            delete(r.devices, id)
        }
    }
}

// ServeAPI exposes a simple JSON endpoint listing all current devices.
func (r *Registry) ServeAPI(addr string) {
    http.HandleFunc("/devices", func(w http.ResponseWriter, req *http.Request) {
        r.mu.Lock()
        defer r.mu.Unlock()
        w.Header().Set("Content-Type", "application/json")
        json.NewEncoder(w).Encode(r.devices)
    })
    log.Fatal(http.ListenAndServe(addr, nil))
}