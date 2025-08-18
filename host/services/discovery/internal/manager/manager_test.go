package manager

import (
	"context"
	"os"
	"path/filepath"
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

// TestStartProxyModeLeaderFile verifies proxy mode uses leader.env when no servers are discovered.
func TestStartProxyModeLeaderFile(t *testing.T) {
	logx.Init(logx.Config{})
	dm := New()

	tmp := t.TempDir()

	// Write leader.env
	leader := filepath.Join(tmp, "leader.env")
	if err := os.WriteFile(leader, []byte("HOST=testhost\nPORT=9999\n"), 0o644); err != nil {
		t.Fatalf("write leader file: %v", err)
	}
	os.Setenv("LEADER_FILE", leader)
	t.Cleanup(func() { os.Unsetenv("LEADER_FILE") })

	// Stub docker compose
	docker := filepath.Join(tmp, "docker")
	if err := os.WriteFile(docker, []byte("#!/bin/sh\nexit 0\n"), 0o755); err != nil {
		t.Fatalf("write stub docker: %v", err)
	}
	origPath := os.Getenv("PATH")
	os.Setenv("PATH", tmp)
	t.Cleanup(func() { os.Setenv("PATH", origPath) })

	if err := dm.startProxyMode(); err != nil {
		t.Fatalf("startProxyMode returned error: %v", err)
	}

	if got := os.Getenv("CAPTURE_DAEMON_URL"); got != "http://testhost:9999" {
		t.Fatalf("expected CAPTURE_DAEMON_URL http://testhost:9999, got %s", got)
	}
	if os.Getenv("UPSTREAM_HOST") != "testhost" || os.Getenv("UPSTREAM_PORT") != "9999" {
		t.Fatalf("upstream vars not set: %s:%s", os.Getenv("UPSTREAM_HOST"), os.Getenv("UPSTREAM_PORT"))
	}
	if os.Getenv("ROLE") != "agent" {
		t.Fatalf("ROLE not set to agent: %s", os.Getenv("ROLE"))
	}
}
