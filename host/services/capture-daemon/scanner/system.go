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
	dev, err := findFirstCaptureDevice() // helper comes from csi_or_usb.go
	if err != nil {
		return nil, err
	}
	return []Device{{
		ID:   dev,
		Kind: "system",
		Path: dev,
		Name: filepath.Base(dev),
		Capabilities: map[string]interface{}{
			"source": "system",
		},
		Status: "online",
	}}, nil
}