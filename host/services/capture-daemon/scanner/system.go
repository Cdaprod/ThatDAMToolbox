// /host/services/capture-daemon/scanner/system.go
package scanner

import (
    "fmt"
    "unsafe"
    "syscall"
    "os"
    "path/filepath"
)

func init() {
    scanner.Register(systemScanner{})
}

type systemScanner struct{}

func (systemScanner) Scan() ([]scanner.Device, error) {
    dev, err := findFirstCaptureDevice()
    if err != nil {
        return nil, err
    }
    return []scanner.Device{{ID: dev, Name: filepath.Base(dev)}}, nil
}

// ...then your findFirstCaptureDevice/isCaptureNode/sortedVideoNodes helper code here...