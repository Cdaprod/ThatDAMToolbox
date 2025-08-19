// /host/services/capture-daemon/scanner/network_test.go
package scanner

import "testing"

// TestNetworkScanner returns configured endpoints as devices.
func TestNetworkScanner(t *testing.T) {
	src := map[string]string{"cam1": "rtsp://example/stream"}
	s := NewNetworkScanner(src)
	devs, err := s.Scan()
	if err != nil {
		t.Fatalf("scan: %v", err)
	}
	if len(devs) != 1 {
		t.Fatalf("expected 1 device, got %d", len(devs))
	}
	if devs[0].Path != "rtsp://example/stream" || devs[0].Kind != "network" {
		t.Fatalf("unexpected device: %+v", devs[0])
	}
}
