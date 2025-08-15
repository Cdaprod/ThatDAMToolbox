package reconcile

import (
	"context"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// IndexReconciler applies desired vector index schema.
type IndexReconciler struct {
	idx ports.VectorIndex
}

// NewIndexReconciler creates an index reconciler.
func NewIndexReconciler(i ports.VectorIndex) IndexReconciler {
	return IndexReconciler{idx: i}
}

// Apply ensures classes and properties exist.
func (r IndexReconciler) Apply(ctx context.Context, spec IndexSpec) error {
	for _, c := range spec.Classes {
		if err := r.idx.EnsureClass(ctx, c); err != nil {
			return err
		}
		if err := r.idx.EnsureProperties(ctx, c.Name, c.Properties); err != nil {
			return err
		}
	}
	return nil
}
