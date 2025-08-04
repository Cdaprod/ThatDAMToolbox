// /host/services/capture-daemon/api/devices.go
package api

import (
    "encoding/json"
    "net/http"
    "strings"

    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/registry"
)

// RegisterRoutes wires up the device API endpoints.
func RegisterRoutes(mux *http.ServeMux, reg *registry.Registry) {
    // List all devices with capabilities
    mux.HandleFunc("/devices", func(w http.ResponseWriter, req *http.Request) {
        if req.Method != http.MethodGet {
            w.WriteHeader(http.StatusMethodNotAllowed)
            return
        }

        // Map[string]Device
        devices := reg.List()
        out := make([]registry.Device, 0, len(devices))
        for _, d := range devices {
            out = append(out, d)
        }
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(out)
    })

    // Show a single device + capabilities
    mux.HandleFunc("/devices/", func(w http.ResponseWriter, req *http.Request) {
        if req.Method != http.MethodGet {
            w.WriteHeader(http.StatusMethodNotAllowed)
            return
        }
        // URL: /devices/{id}
        parts := strings.Split(strings.TrimPrefix(req.URL.Path, "/devices/"), "/")
        if len(parts) < 1 || parts[0] == "" {
            w.WriteHeader(http.StatusBadRequest)
            return
        }
        id := "/" + parts[0] // match /dev/videoX path
        devices := reg.List()
        dev, ok := devices[id]
        if !ok {
            w.WriteHeader(http.StatusNotFound)
            return
        }
        w.Header().Set("Content-Type", "application/json")
        _ = json.NewEncoder(w).Encode(dev)
    })
}