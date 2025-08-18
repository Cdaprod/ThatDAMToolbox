package storage

import "io"

// BlobStore defines minimal operations for byte storage.
// Keys use POSIX-like paths. Implementations must be idempotent.
type BlobStore interface {
	// Put stores bytes from r under key.
	Put(key string, r io.Reader) error
	// Get returns a reader for key; callers must close it.
	Get(key string) (io.ReadCloser, error)
	// Delete removes key if it exists.
	Delete(key string) error
	// Exists reports whether key is present.
	Exists(key string) (bool, error)
	// List calls visit for each key with prefix.
	List(prefix string, visit func(key string) bool) error
}
