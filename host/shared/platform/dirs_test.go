package platform

import (
	"os"
	"path/filepath"
	"syscall"
	"testing"
)

func TestEnsureDirs(t *testing.T) {
	t.Parallel()
	base, err := os.MkdirTemp("", "ensuredirs")
	if err != nil {
		t.Fatalf("temp dir: %v", err)
	}
	defer os.RemoveAll(base)

	target := filepath.Join(base, "data")
	uid := os.Getuid()
	gid := os.Getgid()
	mode := os.FileMode(0o775)

	spec := FileSpec{Path: target, UID: uid, GID: gid, Mode: mode}
	if err := EnsureDirs([]FileSpec{spec}); err != nil {
		t.Fatalf("EnsureDirs: %v", err)
	}
	info, err := os.Stat(target)
	if err != nil {
		t.Fatalf("stat: %v", err)
	}
	if info.Mode().Perm() != mode.Perm() {
		t.Errorf("mode = %v want %v", info.Mode().Perm(), mode.Perm())
	}
	st := info.Sys().(*syscall.Stat_t)
	if int(st.Uid) != uid || int(st.Gid) != gid {
		t.Errorf("ownership = %d:%d want %d:%d", st.Uid, st.Gid, uid, gid)
	}
	// idempotent
	if err := EnsureDirs([]FileSpec{spec}); err != nil {
		t.Fatalf("EnsureDirs second call: %v", err)
	}
}
