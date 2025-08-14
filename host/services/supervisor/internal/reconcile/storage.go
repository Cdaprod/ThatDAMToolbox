package reconcile

import (
	"context"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// StorageReconciler applies desired bucket state.
type StorageReconciler struct {
	store ports.ObjectStorage
}

// NewStorageReconciler creates a storage reconciler.
func NewStorageReconciler(s ports.ObjectStorage) StorageReconciler {
	return StorageReconciler{store: s}
}

// Apply ensures buckets, versioning, lifecycle and tags exist as desired.
func (r StorageReconciler) Apply(ctx context.Context, buckets []StorageBucket) error {
	for _, b := range buckets {
		if err := r.store.EnsureBucket(ctx, b.Name); err != nil {
			return err
		}
		if err := r.store.EnsureVersioning(ctx, b.Name, b.Versioned); err != nil {
			return err
		}
		if err := r.store.EnsureLifecycle(ctx, b.Name, b.Lifecycle); err != nil {
			return err
		}
		if err := r.store.EnsureTags(ctx, b.Name, b.Tags); err != nil {
			return err
		}
	}
	return nil
}
