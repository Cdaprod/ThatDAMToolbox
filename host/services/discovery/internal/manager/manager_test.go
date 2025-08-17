package manager

import (
	"os"
	"testing"
)

// TestDetectDiscoveryBackendDefault ensures we default to mDNS when no env hints are set.
func TestDetectDiscoveryBackendDefault(t *testing.T) {
	os.Unsetenv("SERF_JOIN")
	os.Unsetenv("DISCOVERY_BACKEND")
	dm := New()
	if got := dm.detectDiscoveryBackend(); got != DiscoveryMDNS {
		t.Fatalf("expected %s, got %s", DiscoveryMDNS, got)
	}
}

// TestDetectDiscoveryBackendOverride verifies DISCOVERY_BACKEND forces the backend.
func TestDetectDiscoveryBackendOverride(t *testing.T) {
	os.Setenv("DISCOVERY_BACKEND", "serf")
	t.Cleanup(func() { os.Unsetenv("DISCOVERY_BACKEND") })
	dm := New()
	if got := dm.detectDiscoveryBackend(); got != DiscoverySerf {
		t.Fatalf("expected %s, got %s", DiscoverySerf, got)
	}
}

// TestComposeCmdMissing ensures a clear error when docker-compose is not found.
func TestComposeCmdMissing(t *testing.T) {
	orig := os.Getenv("PATH")
	os.Setenv("PATH", "")
	t.Cleanup(func() { os.Setenv("PATH", orig) })
	if _, err := composeCmd("up"); err == nil {
		t.Fatalf("expected error when docker-compose is missing")
	}
}
