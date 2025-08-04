// /host/services/capture-daemon/scanner/v4l2/v4l2.go
package v4l2

import (
    "os/exec"
    "strings"
    "path/filepath"

    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner"
)

type V4L2Scanner struct{}

func (s *V4L2Scanner) Scan() ([]scanner.Device, error) {
    files, _ := filepath.Glob("/dev/video*")
    var devices []scanner.Device
    for _, file := range files {
        if !scanner.IsCaptureNode(file) {
            continue
        }

        // Query device formats, resolutions, and framerates using v4l2-ctl (best effort)
        capabilities := map[string]interface{}{
            "source":  "v4l2",
            "capture": true,
        }

        // Try v4l2-ctl --list-formats-ext
        out, err := exec.Command("v4l2-ctl", "--device="+file, "--list-formats-ext").CombinedOutput()
        if err == nil {
            formats := parseV4L2Formats(string(out))
            capabilities["formats"] = formats
        } else {
            capabilities["formats"] = []string{}
        }

        devices = append(devices, scanner.Device{
            ID:           file,
            Kind:         "v4l2",
            Path:         file,
            Name:         filepath.Base(file),
            Capabilities: capabilities,
            Status:       "online",
        })
    }
    return devices, nil
}

// parseV4L2Formats parses v4l2-ctl --list-formats-ext output into a struct.
func parseV4L2Formats(raw string) []map[string]interface{} {
    var result []map[string]interface{}
    var current map[string]interface{}
    for _, line := range strings.Split(raw, "\n") {
        line = strings.TrimSpace(line)
        if strings.HasPrefix(line, "Index") {
            if current != nil {
                result = append(result, current)
            }
            current = map[string]interface{}{}
        }
        if strings.HasPrefix(line, "Pixel Format:") {
            pf := strings.TrimSpace(strings.TrimPrefix(line, "Pixel Format:"))
            current["pixel_format"] = pf
        }
        if strings.HasPrefix(line, "Name:") {
            current["name"] = strings.TrimSpace(strings.TrimPrefix(line, "Name:"))
        }
        if strings.HasPrefix(line, "Size: Discrete") {
            sz := strings.TrimSpace(strings.TrimPrefix(line, "Size: Discrete"))
            if current["sizes"] == nil {
                current["sizes"] = []string{}
            }
            current["sizes"] = append(current["sizes"].([]string), sz)
        }
        if strings.HasPrefix(line, "Interval: Discrete") {
            iv := strings.TrimSpace(strings.TrimPrefix(line, "Interval: Discrete"))
            if current["intervals"] == nil {
                current["intervals"] = []string{}
            }
            current["intervals"] = append(current["intervals"].([]string), iv)
        }
    }
    if current != nil && len(current) > 0 {
        result = append(result, current)
    }
    return result
}

func init() {
    scanner.Register(&V4L2Scanner{})
}