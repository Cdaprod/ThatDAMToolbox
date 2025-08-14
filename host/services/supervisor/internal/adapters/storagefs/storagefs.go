package storagefs

// Package storagefs provides a filesystem-based ObjectStorage adapter.
//
// Example usage:
//   store, _ := storagefs.New("/tmp/supervisor")
//   _ = store.EnsureBucket(context.Background(), "media")
//
// This adapter is intended for development and test environments where a
// simple directory structure acts as the object store. Versioning, lifecycle
// rules and tagging are treated as no-ops.

import (
    "context"
    "errors"
    "os"
    "path/filepath"

    "github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// FSStorage implements ports.ObjectStorage using the local filesystem.
type FSStorage struct {
    root string
}

// New creates a new FSStorage rooted at dir, creating it if necessary.
func New(dir string) (*FSStorage, error) {
    if dir == "" {
        return nil, errors.New("dir required")
    }
    if err := os.MkdirAll(dir, 0o755); err != nil {
        return nil, err
    }
    return &FSStorage{root: dir}, nil
}

// EnsureBucket creates a directory for the bucket if it does not exist.
func (f *FSStorage) EnsureBucket(ctx context.Context, name string) error {
    return os.MkdirAll(filepath.Join(f.root, name), 0o755)
}

// EnsureVersioning is a no-op for the filesystem adapter.
func (f *FSStorage) EnsureVersioning(ctx context.Context, name string, enabled bool) error {
    return nil
}

// EnsureLifecycle is a no-op for the filesystem adapter.
func (f *FSStorage) EnsureLifecycle(ctx context.Context, name string, rules []ports.BucketLifecycleRule) error {
    return nil
}

// EnsureTags is a no-op for the filesystem adapter.
func (f *FSStorage) EnsureTags(ctx context.Context, name string, tags map[string]string) error {
    return nil
}

