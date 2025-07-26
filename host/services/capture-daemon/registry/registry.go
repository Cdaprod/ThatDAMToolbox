// /host/services/capture-daemon/registry/registry.go
package registry

import (
    "sync"
    "encoding/json"
    "os"
    "time"
    "net/http"
)

type DeviceInfo struct {
    UID         string    `json:"uid"`
    Kind        string    `json:"kind"`    // e.g. "usb", "ip", "pi"
    Path        string    `json:"path"`    // e.g. "/dev/video2"
    Name        string    `json:"name"`
    Capabilities map[string]interface{} `json:"capabilities"`
    Status      string    `json:"status"`  // "online", "offline"
    LastSeen    time.Time `json:"last_seen"`
    // ...more fields as needed
}

type DeviceScanner interface {
    Scan() ([]DeviceInfo, error)
}

type Registry struct {
    scanners []DeviceScanner
    mu       sync.RWMutex
    devices  map[string]DeviceInfo
}

func NewRegistry(scanners []DeviceScanner) *Registry {
    return &Registry{
        scanners: scanners,
        devices:  make(map[string]DeviceInfo),
    }
}

// Periodically rescan and persist
func (r *Registry) Run(ctx context.Context, interval time.Duration, persistPath string) {
    for {
        select {
        case <-ctx.Done():
            return
        case <-time.After(interval):
            r.scanAll()
            r.persist(persistPath)
        }
    }
}

func (r *Registry) scanAll() {
    r.mu.Lock()
    defer r.mu.Unlock()
    for _, s := range r.scanners {
        devices, err := s.Scan()
        if err != nil { continue }
        for _, d := range devices {
            d.LastSeen = time.Now()
            r.devices[d.UID] = d
        }
    }
    // Remove stale devices if desired
}

func (r *Registry) persist(path string) {
    r.mu.RLock()
    defer r.mu.RUnlock()
    file, err := os.Create(path)
    if err != nil { return }
    defer file.Close()
    _ = json.NewEncoder(file).Encode(r.devices)
}

func (r *Registry) ServeAPI(addr string) {
    http.HandleFunc("/devices", func(w http.ResponseWriter, r *http.Request) {
        r.mu.RLock()
        defer r.mu.RUnlock()
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(r.devices)
    })
    log.Fatal(http.ListenAndServe(addr, nil))
}