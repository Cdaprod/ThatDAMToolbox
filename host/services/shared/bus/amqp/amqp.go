package amqp

import (
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/bus"
	amqp "github.com/rabbitmq/amqp091-go"
)

// Adapter implements bus.Bus over AMQP.
type Adapter struct {
	ch       *amqp.Channel
	conn     *amqp.Connection
	exchange string
}

// New creates a Bus backed by RabbitMQ.
func New(cfg bus.Config) (bus.Bus, error) {
	conn, err := amqp.Dial(cfg.URL)
	if err != nil {
		return nil, err
	}
	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, err
	}
	if err := ch.ExchangeDeclare(cfg.Exchange, "topic", true, false, false, false, nil); err != nil {
		ch.Close()
		conn.Close()
		return nil, err
	}
	return &Adapter{ch: ch, conn: conn, exchange: cfg.Exchange}, nil
}

func (a *Adapter) Publish(topic string, body []byte) error {
	return a.ch.Publish(a.exchange, topic, false, false, amqp.Publishing{Body: body, ContentType: "application/json"})
}

func (a *Adapter) Subscribe(topic string, fn func([]byte)) error {
	q, err := a.ch.QueueDeclare("", false, true, true, false, nil)
	if err != nil {
		return err
	}
	if err := a.ch.QueueBind(q.Name, topic, a.exchange, false, nil); err != nil {
		return err
	}
	msgs, err := a.ch.Consume(q.Name, "", true, true, false, false, nil)
	if err != nil {
		return err
	}
	go func() {
		for m := range msgs {
			fn(m.Body)
		}
	}()
	return nil
}

func (a *Adapter) Close() error {
	if err := a.ch.Close(); err != nil {
		return err
	}
	return a.conn.Close()
}

// Register sets this adapter as default in bus package.
func Register() { bus.SetAdapter(New) }
