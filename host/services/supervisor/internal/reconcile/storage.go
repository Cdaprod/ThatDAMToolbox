package reconcile

import (
	"context"
	"errors"
	"fmt"

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
	var errs []error
	for _, b := range buckets {
		if err := r.store.EnsureBucket(ctx, b.Name); err != nil {
			errs = append(errs, fmt.Errorf("%s: ensure bucket: %w", b.Name, err))
			continue
		}
		if err := r.store.EnsureVersioning(ctx, b.Name, b.Versioned); err != nil {
			errs = append(errs, fmt.Errorf("%s: versioning: %w", b.Name, err))
			continue
		}
		if err := r.store.EnsureLifecycle(ctx, b.Name, b.Lifecycle); err != nil {
			errs = append(errs, fmt.Errorf("%s: lifecycle: %w", b.Name, err))
			continue
		}
		if err := r.store.EnsureTags(ctx, b.Name, b.Tags); err != nil {
			errs = append(errs, fmt.Errorf("%s: tags: %w", b.Name, err))
			continue
		}
	}
	if len(errs) > 0 {
		return errors.Join(errs...)
	}
	return nil
}
