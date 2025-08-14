// /host/services/supervisor/internal/ports/vector.go
// Abstract port for vector schema and upserts. Implementation may be in memory or Weaviate.
package ports

import "context"

type ClassSpec struct {
	Name       string
	Properties []PropertySpec
}

type PropertySpec struct {
	Name string
	Type string
}

type VectorIndex interface {
	EnsureClass(ctx context.Context, c ClassSpec) error
	EnsureProperties(ctx context.Context, class string, props []PropertySpec) error
	UpsertVector(ctx context.Context, class, id string, vector []float32, meta map[string]any) error
}
