// /host/services/capture-daemon/scanner/system.go
package scanner

import "path/filepath"

// auto-register this backend at init-time
func init() {
	Register(systemScanner{})
}

type systemScanner struct{}

// Scan discovers the first usable /dev/video* node reported by the
// shared helpers in csi_or_usb.go and wraps it in a Device.
func (systemScanner) Scan() ([]Device, error) {
    var out []Device
    for _, node := range sortedVideoNodes() {
        if !IsCaptureNode(node) {           // <-- new guard
            continue
        }
        out = append(out, Device{
            ID:   node,
            Kind: "system",
            Path: node,
            Name: filepath.Base(node),
            Capabilities: map[string]interface{}{
                "source": "system",
            },
            Status: "online",
        })
    }
    if len(out) == 0 {
        return nil, fmt.Errorf("no usable capture devices")
    }
    return out, nil
}