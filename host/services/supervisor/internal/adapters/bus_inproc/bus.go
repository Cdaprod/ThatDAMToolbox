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
	"strings"
	"sync"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// InProcBus provides an in-memory pub/sub bus.
type InProcBus struct {
	mu          sync.Mutex
	exchanges   map[string]ports.Exchange
	queues      map[string]ports.Queue
	bindings    map[string]struct{}
	subscribers map[string][]chan []byte
}

// New constructs a new in-process bus.
func New() *InProcBus {
	return &InProcBus{
		exchanges:   make(map[string]ports.Exchange),
		queues:      make(map[string]ports.Queue),
		subscribers: make(map[string][]chan []byte),
		bindings:    make(map[string]struct{}),
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
	k := bd.Exchange + "|" + bd.Queue + "|" + bd.Key
	if _, ok := b.bindings[k]; !ok {
		b.bindings[k] = struct{}{}
	}
	return nil
}

// Publish delivers a message to queues bound with the routing key.
func (b *InProcBus) Publish(ctx context.Context, topic string, body []byte, _ string) error {
	b.mu.Lock()
	defer b.mu.Unlock()
	for k := range b.bindings {
		parts := strings.SplitN(k, "|", 3)
		if len(parts) != 3 {
			continue
		}
		ex, q, rk := parts[0], parts[1], parts[2]
		if ex == topic || rk == topic {
			subs := b.subscribers[q]
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
func (b *InProcBus) Subscribe(queue string) (<-chan []byte, func(), error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if _, ok := b.queues[queue]; !ok {
		return nil, nil, errors.New("queue not declared")
	}
	ch := make(chan []byte, 1)
	b.subscribers[queue] = append(b.subscribers[queue], ch)
	cancel := func() {
		b.mu.Lock()
		defer b.mu.Unlock()
		subs := b.subscribers[queue]
		for i := range subs {
			if subs[i] == ch {
				subs[i] = subs[len(subs)-1]
				subs = subs[:len(subs)-1]
				break
			}
		}
		b.subscribers[queue] = subs
		close(ch)
	}
	return ch, cancel, nil
}
