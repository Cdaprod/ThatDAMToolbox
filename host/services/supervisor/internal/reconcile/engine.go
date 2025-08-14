package reconcile

import "context"

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
func (e Engine) Apply(ctx context.Context, prof Profile) error {
	if err := e.storage.Apply(ctx, prof.Storage); err != nil {
		return err
	}
	if err := e.broker.Apply(ctx, prof.Broker); err != nil {
		return err
	}
	if err := e.index.Apply(ctx, prof.Index); err != nil {
		return err
	}
	return nil
}
