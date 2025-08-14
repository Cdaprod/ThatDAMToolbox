// /host/services/supervisor/internal/ports/storage.go
// Abstract port for bucket and object concerns. Implementation may be filesystem or MinIO.
package ports

import "context"

type BucketLifecycleRule struct {
	ID         string
	Prefix     string
	ExpireDays int
}

type ObjectStorage interface {
	EnsureBucket(ctx context.Context, name string) error
	EnsureVersioning(ctx context.Context, name string, enabled bool) error
	EnsureLifecycle(ctx context.Context, name string, rules []BucketLifecycleRule) error
	EnsureTags(ctx context.Context, name string, tags map[string]string) error
}
