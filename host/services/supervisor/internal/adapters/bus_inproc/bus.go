package businproc

// Package businproc implements an in-memory EventBus adapter.
//
// Example usage:
//   bus := businproc.New()
//   _ = bus.EnsureExchange(ctx, ports.Exchange{Name: "events", Type: "fanout"})
//   ch, _ := bus.Subscribe("queue1")
//   _ = bus.Publish(ctx, "events", []byte("hello"), "id")
//
// The adapter is safe for repeated declarations and intended for tests and
// single-node development.

import (
	"context"
	"errors"
	"sync"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// InProcBus provides an in-memory pub/sub bus.
type InProcBus struct {
	mu          sync.Mutex
	exchanges   map[string]ports.Exchange
	queues      map[string]ports.Queue
	bindings    []ports.Binding
	subscribers map[string][]chan []byte
}

// New constructs a new in-process bus.
func New() *InProcBus {
	return &InProcBus{
		exchanges:   make(map[string]ports.Exchange),
		queues:      make(map[string]ports.Queue),
		subscribers: make(map[string][]chan []byte),
	}
}

// EnsureExchange records the exchange definition.
func (b *InProcBus) EnsureExchange(ctx context.Context, ex ports.Exchange) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.exchanges[ex.Name] = ex
	return nil
}

// EnsureQueue records the queue definition.
func (b *InProcBus) EnsureQueue(ctx context.Context, q ports.Queue) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, ok := b.queues[q.Name]; !ok {
		b.queues[q.Name] = q
	}
	return nil
}

// EnsureBinding records bindings between exchanges and queues.
func (b *InProcBus) EnsureBinding(ctx context.Context, bd ports.Binding) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	b.bindings = append(b.bindings, bd)
	return nil
}

// Publish delivers a message to queues bound with the routing key.
func (b *InProcBus) Publish(ctx context.Context, topic string, body []byte, _ string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, bd := range b.bindings {
		if bd.Key == topic {
			subs := b.subscribers[bd.Queue]
			for _, ch := range subs {
				select {
				case ch <- body:
				default:
				}
			}
		}
	}
	return nil
}

// Subscribe returns a channel receiving messages for the given queue.
func (b *InProcBus) Subscribe(queue string) (<-chan []byte, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, ok := b.queues[queue]; !ok {
		return nil, errors.New("queue not declared")
	}
	ch := make(chan []byte, 1)
	b.subscribers[queue] = append(b.subscribers[queue], ch)
	return ch, nil
}
