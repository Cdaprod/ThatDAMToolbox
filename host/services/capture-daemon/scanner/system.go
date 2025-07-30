// /host/services/capture-daemon/scanner/system.go
package scanner

import (
    "path/filepath"
)

// init auto-registers this scanner
func init() {
    Register(systemScanner{})
}

type systemScanner struct{}

func (systemScanner) Scan() ([]Device, error) {
    dev, err := findFirstCaptureDevice()
    if err != nil {
        return nil, err
    }
    return []Device{{
        ID:   dev,
        Name: filepath.Base(dev),
    }}, nil
}