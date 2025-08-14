package reconcile

import (
	"context"
	"testing"

	businproc "github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/adapters/bus_inproc"
	indexmem "github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/adapters/index_mem"
	storagefs "github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/adapters/storage_fs"
	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// TestEngineApply ensures the engine runs all reconcilers idempotently.
func TestEngineApply(t *testing.T) {
	ctx := context.Background()

	store, err := storagefs.New(t.TempDir())
	if err != nil {
		t.Fatalf("storage: %v", err)
	}
	bus := businproc.New()
	idx := indexmem.New()

	eng := NewEngine(
		NewStorageReconciler(store),
		NewBrokerReconciler(bus),
		NewIndexReconciler(idx),
	)

	prof := Profile{
		Storage: []StorageBucket{{Name: "b1"}},
		Broker: BrokerSpec{
			Exchanges: []ports.Exchange{{Name: "ex", Type: "fanout"}},
			Queues:    []ports.Queue{{Name: "q"}},
			Bindings:  []ports.Binding{{Exchange: "ex", Queue: "q", Key: "k"}},
		},
		Index: IndexSpec{Classes: []ports.ClassSpec{{Name: "cls"}}},
	}

	if err := eng.Apply(ctx, prof); err != nil {
		t.Fatalf("apply1: %v", err)
	}
	// second apply should also succeed (idempotent)
	if err := eng.Apply(ctx, prof); err != nil {
		t.Fatalf("apply2: %v", err)
	}
}
