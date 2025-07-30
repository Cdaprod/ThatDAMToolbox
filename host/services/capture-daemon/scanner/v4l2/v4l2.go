// /host/services/capture-daemon/scanner/v4l2/v4l2.go
package v4l2

import (
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
		devices = append(devices, scanner.Device{
			ID:   file,
			Kind: "v4l2",
			Path: file,
			Name: filepath.Base(file),
			Capabilities: map[string]interface{}{
				"source":  "v4l2",
				"capture": true,
			},
			Status: "online",
		})
	}
	return devices, nil
}

func init() {
    scanner.Register(&V4L2Scanner{})
}