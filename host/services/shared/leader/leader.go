package leader

// Package leader provides a minimal RabbitMQ-based leader election helper.
//
// Example:
//   ld, ok, err := TryBecomeLeader(ctx, "amqp://guest:guest@localhost/", "main")
//   if ok { defer ld.Close(); /* I'm leader */ }

import (
	"context"
	"time"

	amqp "github.com/rabbitmq/amqp091-go"
)

// Leader holds the AMQP connection for an acquired leadership lease.
type Leader struct {
	Conn *amqp.Connection
	Ch   *amqp.Channel
	Q    string
}

// TryBecomeLeader attempts to claim leadership for ring via an exclusive queue.
// It returns (leader, true, nil) on success, (nil, false, nil) if another
// leader exists, or an error on transport failures.
func TryBecomeLeader(ctx context.Context, amqpURL, ring string) (*Leader, bool, error) {
	conn, err := amqp.Dial(amqpURL)
	if err != nil {
		return nil, false, err
	}
	ch, err := conn.Channel()
	if err != nil {
		conn.Close()
		return nil, false, err
	}
	qname := "lock.ring." + ring
	_, err = ch.QueueDeclare(qname, false, true, true, false, amqp.Table{"x-expires": int32(20000)})
	if err != nil {
		ch.Close()
		conn.Close()
		return nil, false, nil
	}
	ld := &Leader{Conn: conn, Ch: ch, Q: qname}
	go func() {
		t := time.NewTicker(5 * time.Second)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				ld.Close()
				return
			case <-t.C:
				if _, e := ch.QueueDeclarePassive(qname, false, true, true, false, nil); e != nil {
					ld.Close()
					return
				}
			}
		}
	}()
	return ld, true, nil
}

// Close releases the leadership lease.
func (l *Leader) Close() {
	if l.Ch != nil {
		_ = l.Ch.Close()
	}
	if l.Conn != nil {
		_ = l.Conn.Close()
	}
}
