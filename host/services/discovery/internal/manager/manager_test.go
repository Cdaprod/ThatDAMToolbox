package manager

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
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

// TestDecideModeNoCompose forces proxy mode when docker-compose is unavailable.
func TestDecideModeNoCompose(t *testing.T) {
	orig := os.Getenv("PATH")
	os.Setenv("PATH", "")
	t.Cleanup(func() { os.Setenv("PATH", orig) })
	logx.Init(logx.Config{})
	dm := New()
	dm.decideMode()
	if dm.mode != ModeProxy {
		t.Fatalf("expected %s, got %s", ModeProxy, dm.mode)
	}
}

// TestStartProxyModeWaits ensures proxy mode waits for a server rather than exiting immediately.
func TestStartProxyModeWaits(t *testing.T) {
	logx.Init(logx.Config{})
	dm := New()
	errCh := make(chan error, 1)
	go func() { errCh <- dm.startProxyMode() }()
	time.Sleep(50 * time.Millisecond)
	dm.cancel()
	if err := <-errCh; err != context.Canceled {
		t.Fatalf("expected context canceled, got %v", err)
	}
}
