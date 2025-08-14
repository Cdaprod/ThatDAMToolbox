package reconcile

import (
	"context"
	"errors"
	"fmt"
)

// Engine runs reconcilers in a fixed order.
type Engine struct {
	storage StorageReconciler
	broker  BrokerReconciler
	index   IndexReconciler
}

// NewEngine constructs an Engine using provided ports.
func NewEngine(store StorageReconciler, broker BrokerReconciler, index IndexReconciler) Engine {
	return Engine{storage: store, broker: broker, index: index}
}

// Apply runs all reconcilers against the profile.
// Apply runs reconcilers in order; continues on component errors and returns a combined error.
func (e Engine) Apply(ctx context.Context, prof Profile) error {
	var errs []error
	if err := e.storage.Apply(ctx, prof.Storage); err != nil {
		errs = append(errs, fmt.Errorf("storage: %w", err))
	}
	if err := e.broker.Apply(ctx, prof.Broker); err != nil {
		errs = append(errs, fmt.Errorf("broker: %w", err))
	}
	if err := e.index.Apply(ctx, prof.Index); err != nil {
		errs = append(errs, fmt.Errorf("index: %w", err))
	}
	if len(errs) > 0 {
		return errors.Join(errs...)
	}
	return nil
}
