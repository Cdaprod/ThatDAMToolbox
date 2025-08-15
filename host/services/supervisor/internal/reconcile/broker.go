package reconcile

import (
	"context"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// BrokerReconciler applies desired messaging state.
type BrokerReconciler struct {
	bus ports.EventBus
}

// NewBrokerReconciler creates a broker reconciler.
func NewBrokerReconciler(b ports.EventBus) BrokerReconciler {
	return BrokerReconciler{bus: b}
}

// Apply declares exchanges, queues and bindings.
func (r BrokerReconciler) Apply(ctx context.Context, spec BrokerSpec) error {
	for _, ex := range spec.Exchanges {
		if err := r.bus.EnsureExchange(ctx, ex); err != nil {
			return err
		}
	}
	for _, q := range spec.Queues {
		if err := r.bus.EnsureQueue(ctx, q); err != nil {
			return err
		}
	}
	for _, b := range spec.Bindings {
		if err := r.bus.EnsureBinding(ctx, b); err != nil {
			return err
		}
	}
	return nil
}
