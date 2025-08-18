package bus

import (
	"context"
	"sync"
	"testing"
)

type mockBus struct {
	mu   sync.Mutex
	subs map[string]func([]byte)
}

func newMockBus(cfg Config) (Bus, error) {
	return &mockBus{subs: make(map[string]func([]byte))}, nil
}

func (m *mockBus) Publish(topic string, b []byte) error {
	m.mu.Lock()
	fn := m.subs[topic]
	m.mu.Unlock()
	if fn != nil {
		fn(b)
	}
	return nil
}

func (m *mockBus) Subscribe(topic string, fn func([]byte)) error {
	m.mu.Lock()
	m.subs[topic] = fn
	m.mu.Unlock()
	return nil
}

func (m *mockBus) Close() error { return nil }

func reset() {
	once = sync.Once{}
	inst = nil
	instErr = nil
	adapterCtor = nil
}

func TestPublishSubscribe(t *testing.T) {
	reset()
	adapterCtor = newMockBus
	cfg := Config{URL: "amqp://test", Exchange: "events"}
	if _, err := Connect(context.Background(), cfg); err != nil {
		t.Fatalf("connect: %v", err)
	}

	done := make(chan []byte, 1)
	if err := Subscribe("foo", func(b []byte) { done <- b }); err != nil {
		t.Fatalf("sub: %v", err)
	}
	if err := Publish("foo", map[string]string{"a": "b"}); err != nil {
		t.Fatalf("pub: %v", err)
	}

	select {
	case msg := <-done:
		if string(msg) != "{\"a\":\"b\"}" {
			t.Fatalf("unexpected: %s", msg)
		}
	default:
		t.Fatal("no message")
	}
}

func TestConnectNoAdapter(t *testing.T) {
	reset()
	cfg := Config{URL: "amqp://test", Exchange: "events"}
	if _, err := Connect(context.Background(), cfg); err == nil {
		t.Fatal("expected error when no adapter registered")
	}
}

func TestConnectMissingURL(t *testing.T) {
	reset()
	t.Setenv("BROKER_URL", "")
	t.Setenv("EVENT_BROKER_URL", "")
	adapterCtor = newMockBus
	cfg := Config{Exchange: "events"}
	if _, err := Connect(context.Background(), cfg); err == nil {
		t.Fatal("expected error for missing broker URL")
	}
}

func TestConnectMissingExchange(t *testing.T) {
	reset()
	t.Setenv("BROKER_EXCHANGE", "")
	t.Setenv("AMQP_EXCHANGE", "")
	adapterCtor = newMockBus
	cfg := Config{URL: "amqp://test"}
	if _, err := Connect(context.Background(), cfg); err == nil {
		t.Fatal("expected error for missing exchange")
	}
}
