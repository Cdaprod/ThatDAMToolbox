package storagefs

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/shared/platform"
)

type testDirEnsurer struct{}

func (testDirEnsurer) EnsureDirs(specs []platform.FileSpec) error {
	for _, s := range specs {
		if err := os.MkdirAll(s.Path, 0o755); err != nil {
			return err
		}
	}
	return nil
}

// TestEnsureBucket verifies bucket creation is idempotent.
func TestEnsureBucket(t *testing.T) {
	dir := t.TempDir()
	store, err := New(dir, testDirEnsurer{})
	if err != nil {
		t.Fatalf("new store: %v", err)
	}

	if err := store.EnsureBucket(context.Background(), "a"); err != nil {
		t.Fatalf("ensure bucket: %v", err)
	}
	// second call should be no-op
	if err := store.EnsureBucket(context.Background(), "a"); err != nil {
		t.Fatalf("ensure bucket again: %v", err)
	}

	if _, err := os.Stat(filepath.Join(dir, "a")); err != nil {
		t.Fatalf("bucket missing: %v", err)
	}
}
