// Package scanner provides a pluggable interface for discovering devices.
package scanner

// Scanner is implemented by all device discovery modules (V4L2, Pi, IPCam, etc.)
type Scanner interface {
    Scan() ([]Device, error)
}

// Device represents a discovered video or audio capture device.
type Device struct {
    ID   string // Unique identifier for the device
    Name string // Human-readable device name
    // ...add more fields as needed (Type, Path, Metadata, etc.)
}

var scanners []Scanner

// Register allows a scanner module to add itself to the global registry.
// Usually called from init() in each scanner implementation.
func Register(s Scanner) {
    scanners = append(scanners, s)
}

// ScanAll invokes Scan() on all registered scanners, merging their results.
// Errors from individual scanners are ignored (but could be logged).
func ScanAll() ([]Device, error) {
    var all []Device
    for _, s := range scanners {
        devices, err := s.Scan()
        if err != nil {
            // Optionally log error: log.Printf("scanner error: %v", err)
            continue
        }
        all = append(all, devices...)
    }
    return all, nil
}