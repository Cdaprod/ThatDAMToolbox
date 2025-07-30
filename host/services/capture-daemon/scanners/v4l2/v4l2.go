/host/services/capture-daemon/scanners/v4l2.go
package scanners

import (
    "io/ioutil"
    "ThatDamToolbox/host/services/capture-daemon/registry"
    "strings"
    "path/filepath"
    "fmt"
)

// V4L2Scanner detects /dev/video* devices
type V4L2Scanner struct{}

const fallbackDev = "/dev/video9"

func hasRealCamera(nodes []string) bool {
    for _, n := range nodes {
        if n != fallbackDev {
            return true
        }
    }
    return false
}

func (s *V4L2Scanner) Scan() ([]registry.DeviceInfo, error) {
    files, _ := filepath.Glob("/dev/video*")
    if !hasRealCamera(files) {
        // ensure the fallback is still reported
        files = append(files, fallbackDev)
    }

    var devices []registry.DeviceInfo
    for _, file := range files {
        devices = append(devices, registry.DeviceInfo{
            UID:  file,
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