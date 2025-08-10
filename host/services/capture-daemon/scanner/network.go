// /host/services/capture-daemon/scanner/network.go
// NetworkScanner returns statically configured network streams as devices.
// Example usage:
//
//	s := scanner.NewNetworkScanner(map[string]string{"lobby": "rtsp://cam/stream"})
//	devices, _ := s.Scan()
package scanner

// NetworkScanner enumerates configured network endpoints.
type NetworkScanner struct {
	Sources map[string]string
}

// NewNetworkScanner creates a scanner for the provided sources.
func NewNetworkScanner(src map[string]string) *NetworkScanner {
	return &NetworkScanner{Sources: src}
}

// Scan returns a Device for each configured stream.
func (s *NetworkScanner) Scan() ([]Device, error) {
	devices := make([]Device, 0, len(s.Sources))
	for id, url := range s.Sources {
		devices = append(devices, Device{
			ID:   id,
			Kind: "network",
			Path: url,
			Name: id,
			Capabilities: map[string]interface{}{
				"source": "network",
			},
			Status: "online",
		})
	}
	return devices, nil
}
