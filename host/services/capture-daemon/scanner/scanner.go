package scanner

import "time"

// Device represents everything we know about a discovered capture device.
type Device struct {
    ID           string                 `json:"id"`             // was UID
    Kind         string                 `json:"kind,omitempty"` // "v4l2", "usb", "ip", etc.
    Path         string                 `json:"path,omitempty"` // e.g. "/dev/video0"
    Name         string                 `json:"name"`           // human-readable
    Capabilities map[string]interface{} `json:"capabilities"`   // whatever the scanner filled in
    Status       string                 `json:"status,omitempty"`
    LastSeen     time.Time              `json:"last_seen"`
}

// Scanner is implemented by each discovery module.
type Scanner interface {
    Scan() ([]Device, error)
}

var scanners []Scanner

// Register adds a new discovery backend (called in each scanner’s init).
func Register(s Scanner) {
    scanners = append(scanners, s)
}

// ScanAll runs every scanner and merges their results.
func ScanAll() ([]Device, error) {
    var all []Device
    now := time.Now()
    for _, s := range scanners {
        devs, err := s.Scan()
        if err != nil {
            // optionally log
            continue
        }
        for _, d := range devs {
            d.LastSeen = now
            all = append(all, d)
        }
    }
    return all, nil
}