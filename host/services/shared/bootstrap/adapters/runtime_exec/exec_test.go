package runtimeexec

import (
	"context"
	"os"
	"path/filepath"
	"testing"
	"time"

	ports "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/ports"
)

func TestRestartAlways(t *testing.T) {
	rt := New()
	tmp := t.TempDir()
	log := filepath.Join(tmp, "count")
	script := filepath.Join(tmp, "s.sh")
	if err := os.WriteFile(script, []byte("#!/bin/sh\necho x >>"+log+"\nexit 1\n"), 0o755); err != nil {
		t.Fatalf("write script: %v", err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := rt.Ensure(ctx, ports.UnitSpec{Name: "s", Command: []string{script}, Restart: "always"}); err != nil {
		t.Fatalf("ensure: %v", err)
	}
	time.Sleep(200 * time.Millisecond)
	if err := rt.Stop(ctx, "s"); err != nil {
		t.Fatalf("stop: %v", err)
	}
	data, err := os.ReadFile(log)
	if err != nil {
		t.Fatalf("read log: %v", err)
	}
	if len(data) == 0 {
		t.Fatalf("expected restarts, log empty")
	}
}
