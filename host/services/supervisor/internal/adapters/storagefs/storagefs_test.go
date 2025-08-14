package storagefs

import (
    "context"
    "os"
    "path/filepath"
    "testing"
)

// TestEnsureBucket verifies bucket creation is idempotent.
func TestEnsureBucket(t *testing.T) {
    dir := t.TempDir()
    store, err := New(dir)
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

