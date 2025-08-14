// /host/services/supervisor/internal/ports/bus.go
// Abstract port for messaging. Implementation may be in process or RabbitMQ.
package ports

import "context"

type Exchange struct {
	Name string
	Type string
}

type Queue struct {
	Name string
	TTL  int
	DLX  string
}

type Binding struct {
	Exchange string
	Queue    string
	Key      string
}

type EventBus interface {
	EnsureExchange(ctx context.Context, ex Exchange) error
	EnsureQueue(ctx context.Context, q Queue) error
	EnsureBinding(ctx context.Context, b Binding) error
	Publish(ctx context.Context, topic string, body []byte, idempotencyKey string) error
}
