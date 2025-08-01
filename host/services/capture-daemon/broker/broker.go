// host/services/capture-daemon/broker/broker.go
//
// Fault-tolerant RabbitMQ helper used by the capture-daemon.
// • zero-conf dev mode  – if $AMQP_URL is empty, Publish() is a no-op.
// • reconnect loop      – exponential back-off, loss-tolerant buffer.
// • non-blocking API    – caller never waits on the network.
// • Close() helper      – graceful shutdown for `go test` or SIGTERM.
//
package broker

import (
	"context"
	"encoding/json"
	"log"
	"os"
	"strconv"
	"sync"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

var (
	addr         = os.Getenv("AMQP_URL")
	exchangeName = firstNonEmpty(os.Getenv("BROKER_EXCHANGE"), "events")

	// ring-buffer defaults to 256 msgs but can be tuned via env
	bufSize, _ = strconv.Atoi(firstNonEmpty(os.Getenv("BROKER_BUFFER"), "256"))
	buf        = make(chan amqp.Publishing, bufSize)

	initOnce   sync.Once
	cancelFunc context.CancelFunc
)

// Init *must* be called once from main() – it returns immediately.
func Init() {
	initOnce.Do(func() {
		if addr == "" {
			log.Println("[broker] AMQP_URL not set – running in in-proc mode")
			return
		}
		ctx, cancel := context.WithCancel(context.Background())
		cancelFunc = cancel
		go run(ctx)
	})
}

// Close drains the buffer and stops the background goroutine.
// Safe to call multiple times (e.g. defer broker.Close()).
func Close() {
	if cancelFunc != nil {
		cancelFunc()
		cancelFunc = nil
	}
}

// Envelope is what we actually serialise and send.
type Envelope struct {
	Topic   string      `json:"topic"`
	Ts      int64       `json:"ts"`
	Payload interface{} `json:"payload"`
}

// Publish is goroutine-safe, never blocks the caller.
// If the buffer overflows the message is dropped (with a warning).
func Publish(topic string, payload any) {
	if addr == "" {
		return // dev / unit-test mode
	}

	env := Envelope{Topic: topic, Ts: time.Now().Unix(), Payload: payload}
	body, _ := json.Marshal(env)

	pub := amqp.Publishing{
		ContentType: "application/json",
		Timestamp:   time.Now(),
		Type:        topic, // used as routing-key
		Body:        body,
	}

	select {
	case buf <- pub:
	default:
		log.Printf("[broker] ⚠️  buffer full (%d msgs) – dropping %s", bufSize, topic)
	}
}

////////////////////////////////////////////////////////////////////////////////
// internal – connection / retry glue
////////////////////////////////////////////////////////////////////////////////

func run(ctx context.Context) {
	backoff := time.Second

	for {
		if err := connectAndPump(ctx); err != nil {
			log.Printf("[broker] %v – reconnecting in %s", err, backoff)
			select {
			case <-time.After(backoff):
			case <-ctx.Done():
				return
			}
			if backoff < 30*time.Second {
				backoff *= 2
			}
		} else {
			return // ctx cancelled gracefully
		}
	}
}

func connectAndPump(ctx context.Context) error {
	conn, err := amqp.Dial(addr)
	if err != nil {
		return err
	}
	defer conn.Close()

	ch, err := conn.Channel()
	if err != nil {
		return err
	}
	defer ch.Close()

	if err := ch.ExchangeDeclare(
		exchangeName, "topic",
		true,  // durable
		false, // autoDelete
		false, // internal
		false, // noWait
		nil,
	); err != nil {
		return err
	}

	// Enable publisher confirms → we know if a message made it
	if err := ch.Confirm(false); err != nil {
		return err
	}
	acks := ch.NotifyPublish(make(chan amqp.Confirmation, 1))

	log.Printf("[broker] ✅ connected to %s (exch=%s, buf=%d)", addr, exchangeName, bufSize)

	for {
		select {
		case pub := <-buf:
			// lazy queue declare & bind so the message is always routable
			_, _ = ch.QueueDeclare(pub.Type, true, false, false, false, nil)
			_ = ch.QueueBind(pub.Type, pub.Type, exchangeName, false, nil)

			if err := ch.PublishWithContext(ctx, exchangeName, pub.Type, false, false, pub); err != nil {
				return err // triggers reconnect
			}
			if ok := <-acks; !ok.Ack {
				log.Printf("[broker] ❌ NACK on %s", pub.Type)
			}

		case <-ctx.Done():
			// drain any remaining messages so they are not lost on tests
			close(buf)
			for pub := range buf {
				_ = ch.PublishWithContext(context.Background(), exchangeName, pub.Type, false, false, pub)
			}
			return nil
		}
	}
}

////////////////////////////////////////////////////////////////////////////////
// tiny helper
////////////////////////////////////////////////////////////////////////////////

func firstNonEmpty(a, b string) string {
	if a != "" {
		return a
	}
	return b
}