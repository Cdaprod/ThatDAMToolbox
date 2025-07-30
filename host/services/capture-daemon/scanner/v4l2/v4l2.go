// /host/services/capture-daemon/scanner/v4l2/v4l2.go
package v4l2

import (
    "path/filepath"

    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner"
)

type V4L2Scanner struct{}

const fallbackDev = "/dev/video9"

// If *all* /dev/video* nodes are fallback, assume no real camera
func hasRealCamera(nodes []string) bool {
    for _, n := range nodes {
        if n != fallbackDev {
            return true
        }
    }
    return false
}

func (s *V4L2Scanner) Scan() ([]scanner.Device, error) {
    files, _ := filepath.Glob("/dev/video*")
    if !hasRealCamera(files) {
        // ensure the fallback is still reported
        files = append(files, fallbackDev)
    }

    var devices []scanner.Device
    for _, file := range files {
        devices = append(devices, scanner.Device{
            ID:   file,
            Kind: "v4l2",
            Path: file,
            Name: filepath.Base(file),
            Capabilities: map[string]interface{}{
                "source": "v4l2",
            },
            Status: "online",
        })
    }
    return devices, nil
}

func init() {
    scanner.Register(&V4L2Scanner{})
}