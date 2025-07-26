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

func (s *V4L2Scanner) Scan() ([]registry.DeviceInfo, error) {
    var devices []registry.DeviceInfo
    files, err := filepath.Glob("/dev/video*")
    if err != nil {
        return nil, err
    }
    for _, file := range files {
        // Optionally: gather more info via v4l2-ctl
        dev := registry.DeviceInfo{
            UID:   file,             // For now, path is UID. Improve later.
            Kind:  "v4l2",
            Path:  file,
            Name:  file,
            Capabilities: map[string]interface{}{
                "source": "v4l2",
            },
            Status: "online",
        }
        devices = append(devices, dev)
    }
    return devices, nil
}