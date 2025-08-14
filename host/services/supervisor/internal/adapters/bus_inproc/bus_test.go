package businproc

import (
	"context"
	"testing"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// TestPublish verifies messages reach subscribers.
func TestPublish(t *testing.T) {
	bus := New()
	ctx := context.Background()
	ex := ports.Exchange{Name: "ex", Type: "fanout"}
	if err := bus.EnsureExchange(ctx, ex); err != nil {
		t.Fatalf("exchange: %v", err)
	}
	q := ports.Queue{Name: "q"}
	if err := bus.EnsureQueue(ctx, q); err != nil {
		t.Fatalf("queue: %v", err)
	}
	b := ports.Binding{Exchange: "ex", Queue: "q", Key: "k"}
	if err := bus.EnsureBinding(ctx, b); err != nil {
		t.Fatalf("binding: %v", err)
	}

	ch, cancel, err := bus.Subscribe("q")
	if err != nil {
		t.Fatalf("subscribe: %v", err)
	}
	defer cancel()

	if err := bus.Publish(ctx, "k", []byte("hi"), "id1"); err != nil {
		t.Fatalf("publish: %v", err)
	}

	select {
	case msg := <-ch:
		if string(msg) != "hi" {
			t.Fatalf("unexpected msg: %s", msg)
		}
	case <-time.After(time.Second):
		t.Fatal("timeout waiting for message")
	}

	// second publish to confirm idempotent bindings
	if err := bus.Publish(ctx, "k", []byte("hi"), "id2"); err != nil {
		t.Fatalf("publish2: %v", err)
	}
}
