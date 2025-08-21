package bus

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Config holds connection settings for the message bus.
type Config struct {
	URL      string
	Exchange string
}

// Bus exposes a minimal publish/subscribe API.
// Messages are JSON-encoded before publishing.
type Bus interface {
	Publish(topic string, b []byte) error
	Subscribe(topic string, fn func([]byte)) error
	Close() error
}

var (
	once    sync.Once
	inst    Bus
	instErr error
)

// adapterCtor dials the underlying transport.
var adapterCtor func(Config) (Bus, error)

// SetAdapter allows adapters to register themselves.
func SetAdapter(fn func(Config) (Bus, error)) { adapterCtor = fn }

// Connect initialises the singleton bus connection.
// It returns an error if the broker URL or exchange is missing,
// if no adapter has been registered, or if the adapter cannot connect.
func Connect(ctx context.Context, cfg Config) (Bus, error) {
	once.Do(func() {
		if cfg.URL == "" {
			cfg.URL = os.Getenv("BROKER_URL")
			if cfg.URL == "" {
				cfg.URL = os.Getenv("EVENT_BROKER_URL")
			}
		}
		if cfg.URL == "" {
			instErr = errors.New("bus: missing broker URL")
			return
		}
		if cfg.Exchange == "" {
			cfg.Exchange = os.Getenv("BROKER_EXCHANGE")
			if cfg.Exchange == "" {
				cfg.Exchange = os.Getenv("AMQP_EXCHANGE")
			}
		}
		if cfg.Exchange == "" {
			instErr = errors.New("bus: missing exchange")
			return
		}
		if adapterCtor == nil {
			instErr = errors.New("bus: no adapter registered")
			return
		}
		var err error
		inst, err = adapterCtor(cfg)
		if err != nil {
			instErr = fmt.Errorf("bus: connect: %w", err)
			inst = nil
		}
	})
	return inst, instErr
}

// Publish sends v to topic using JSON encoding.
func Publish(topic string, v any) error {
	if inst == nil {
		return errors.New("bus not connected")
	}
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	return inst.Publish(topic, b)
}

// Subscribe registers fn for messages on topic.
func Subscribe(topic string, fn func([]byte)) error {
	if inst == nil {
		return errors.New("bus not connected")
	}
	return inst.Subscribe(topic, fn)
}

// Close closes the underlying connection.
func Close() error {
	if inst == nil {
		return nil
	}
	err := inst.Close()
	inst = nil
	return err
}

// PublishTenantEvent publishes a tenant.* event and appends it to the audit log.
func PublishTenantEvent(action string, payload any) error {
	topic := "tenant." + action
	if err := Publish(topic, payload); err != nil {
		return err
	}
	entry := map[string]any{
		"topic":   topic,
		"payload": payload,
		"ts":      time.Now().UTC(),
	}
	b, err := json.Marshal(entry)
	if err != nil {
		return err
	}
	path := filepath.Join("data", "audit.log")
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return err
	}
	if _, err := f.Write(append(b, '\n')); err != nil {
		f.Close()
		return err
	}
	return f.Close()
}
