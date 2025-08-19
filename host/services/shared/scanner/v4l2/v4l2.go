// Package v4l2 provides a scanner that discovers local V4L2 devices using the
// shared hostcap v4l2probe. It registers itself on import.
//
// Example:
//
//	import _ "github.com/Cdaprod/ThatDamToolbox/host/services/shared/scanner/v4l2"
//
//	devices, _ := scanner.ScanAll()
package v4l2

import (
	"context"
	"time"

	v4l2probe "github.com/Cdaprod/ThatDamToolbox/host/services/shared/hostcap/v4l2probe"
	sharedscanner "github.com/Cdaprod/ThatDamToolbox/host/services/shared/scanner"
)

// Scanner enumerates V4L2 capture devices.
type Scanner struct{}

// Scan implements scanner.Scanner.
func (Scanner) Scan() ([]sharedscanner.Device, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	kept, _, err := v4l2probe.Discover(ctx, v4l2probe.DefaultOptions())
	if err != nil {
		return nil, err
	}
	devices := make([]sharedscanner.Device, 0, len(kept))
	for _, d := range kept {
		devices = append(devices, sharedscanner.Device{
			ID:   d.Node,
			Kind: "v4l2",
			Path: d.Node,
			Name: d.Name,
			Capabilities: map[string]interface{}{
				"caps":  d.Caps,
				"class": d.Kind,
			},
			Status: "online",
		})
	}
	return devices, nil
}

func init() { sharedscanner.Register(Scanner{}) }
