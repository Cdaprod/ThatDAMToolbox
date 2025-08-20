package log

// Package log provides a simple append-only message bus that writes
// messages to topic-based log files. It mimics Kafka's sequential disk
// access pattern but is scoped for local development and testing.
//
// Usage:
//
//import (
//"context"
//"github.com/Cdaprod/ThatDamToolbox/host/services/shared/bus"
//"github.com/Cdaprod/ThatDamToolbox/host/services/shared/bus/log"
//)
//
//func main() {
//log.Register()
//b, _ := bus.Connect(context.Background(), bus.Config{URL: "/tmp/bus", Exchange: ""})
//_ = b.Publish("foo", []byte("hello"))
//}
//
// The adapter stores messages under <dir>/<topic>.log and delivers them
// to subscribers in publish order.
//
// Example:
//
//// go test ./host/services/shared/bus/log
//
import (
	"bufio"
	"errors"
	"os"
	"path/filepath"
	"sync"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/bus"
)

// Adapter implements bus.Bus using append-only log files.
type Adapter struct {
	dir  string
	mu   sync.RWMutex
	subs map[string][]func([]byte)
}

// New creates a new log-backed bus. cfg.URL should point to a directory
// where topic log files will be created.
func New(cfg bus.Config) (bus.Bus, error) {
	if cfg.URL == "" {
		return nil, errors.New("log: missing directory")
	}
	if err := os.MkdirAll(cfg.URL, 0o755); err != nil {
		return nil, err
	}
	return &Adapter{dir: cfg.URL, subs: make(map[string][]func([]byte))}, nil
}

// Publish appends b to the topic log and notifies subscribers.
func (a *Adapter) Publish(topic string, b []byte) error {
	path := filepath.Join(a.dir, topic+".log")
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o644)
	if err != nil {
		return err
	}
	if _, err := f.Write(append(b, '\n')); err != nil {
		f.Close()
		return err
	}
	if err := f.Sync(); err != nil {
		f.Close()
		return err
	}
	if err := f.Close(); err != nil {
		return err
	}

	a.mu.RLock()
	subs := append([]func([]byte){}, a.subs[topic]...)
	a.mu.RUnlock()
	for _, fn := range subs {
		fn(b)
	}
	return nil
}

// Subscribe replays existing messages for topic and registers fn for future ones.
func (a *Adapter) Subscribe(topic string, fn func([]byte)) error {
	path := filepath.Join(a.dir, topic+".log")
	if f, err := os.Open(path); err == nil {
		scanner := bufio.NewScanner(f)
		for scanner.Scan() {
			fn([]byte(scanner.Text()))
		}
		_ = f.Close()
	}
	a.mu.Lock()
	a.subs[topic] = append(a.subs[topic], fn)
	a.mu.Unlock()
	return nil
}

// Close releases resources. The log adapter holds no long-lived resources.
func (a *Adapter) Close() error { return nil }

// Register sets the log adapter as the bus default.
func Register() { bus.SetAdapter(New) }
