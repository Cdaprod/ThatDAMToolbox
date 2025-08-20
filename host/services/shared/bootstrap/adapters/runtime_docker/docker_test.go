package runtimedocker

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

// TestStateRunning verifies that State reports an active container.
func TestStateRunning(t *testing.T) {
	tmp := t.TempDir()
	stub := filepath.Join(tmp, "docker")
	script := "#!/bin/sh\nif [ \"$2\" = \"running\" ]; then\n  echo '{\"Running\":true,\"Pid\":111,\"ExitCode\":0,\"Status\":\"running\"}'\nelse\n  echo '{\"Running\":false,\"Pid\":0,\"ExitCode\":42,\"Status\":\"exited\"}'\nfi\n"
	if err := os.WriteFile(stub, []byte(script), 0o755); err != nil {
		t.Fatalf("write stub: %v", err)
	}
	origPath := os.Getenv("PATH")
	os.Setenv("PATH", tmp+":"+origPath)
	defer os.Setenv("PATH", origPath)

	rt := New("")
	st, err := rt.State(context.Background(), "running")
	if err != nil {
		t.Fatalf("state: %v", err)
	}
	if !st.Active || st.Pid != 111 || st.ExitCode != 0 || st.Message != "running" {
		t.Fatalf("unexpected state: %+v", st)
	}
}

// TestStateStopped verifies that State reports an exited container.
func TestStateStopped(t *testing.T) {
	tmp := t.TempDir()
	stub := filepath.Join(tmp, "docker")
	script := "#!/bin/sh\nif [ \"$2\" = \"running\" ]; then\n  echo '{\"Running\":true,\"Pid\":111,\"ExitCode\":0,\"Status\":\"running\"}'\nelse\n  echo '{\"Running\":false,\"Pid\":0,\"ExitCode\":7,\"Status\":\"exited\"}'\nfi\n"
	if err := os.WriteFile(stub, []byte(script), 0o755); err != nil {
		t.Fatalf("write stub: %v", err)
	}
	origPath := os.Getenv("PATH")
	os.Setenv("PATH", tmp+":"+origPath)
	defer os.Setenv("PATH", origPath)

	rt := New("")
	st, err := rt.State(context.Background(), "stopped")
	if err != nil {
		t.Fatalf("state: %v", err)
	}
	if st.Active || st.ExitCode != 7 || st.Message != "exited" {
		t.Fatalf("unexpected state: %+v", st)
	}
}
