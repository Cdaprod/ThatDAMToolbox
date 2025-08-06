package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
)

// TestDiscoverDevicesIncludesDaemon ensures capture-daemon devices are merged.
func TestDiscoverDevicesIncludesDaemon(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/devices" {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`[{"id":"/dev/video1","name":"cam"}]`))
		}
	}))
	defer srv.Close()

	os.Setenv("CAPTURE_DAEMON_URL", srv.URL)
	proxy, err := NewDeviceProxy("http://backend", "http://frontend")
	if err != nil {
		t.Fatalf("NewDeviceProxy: %v", err)
	}
	if err := proxy.discoverDevices(); err != nil {
		t.Fatalf("discoverDevices: %v", err)
	}
	if _, ok := proxy.devices["daemon:/dev/video1"]; !ok {
		t.Fatalf("expected daemon device to be merged")
	}
}
