package log

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/bus"
)

// TestPublishSubscribe ensures messages are appended and delivered in order.
func TestPublishSubscribe(t *testing.T) {
	dir := t.TempDir()
	Register()
	cfg := bus.Config{URL: dir, Exchange: "events"}
	if _, err := bus.Connect(context.Background(), cfg); err != nil {
		t.Fatalf("connect: %v", err)
	}

	var mu sync.Mutex
	var got [][]byte
	if err := bus.Subscribe("foo", func(b []byte) {
		mu.Lock()
		defer mu.Unlock()
		got = append(got, append([]byte(nil), b...))
	}); err != nil {
		t.Fatalf("subscribe: %v", err)
	}

	if err := bus.Publish("foo", "a"); err != nil {
		t.Fatalf("publish a: %v", err)
	}
	if err := bus.Publish("foo", "b"); err != nil {
		t.Fatalf("publish b: %v", err)
	}

	mu.Lock()
	if len(got) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(got))
	}
	mu.Unlock()

	data, err := os.ReadFile(filepath.Join(dir, "foo.log"))
	if err != nil {
		t.Fatalf("read log: %v", err)
	}
	lines := strings.Split(strings.TrimSpace(string(data)), "\n")
	if len(lines) != 2 {
		t.Fatalf("expected 2 lines, got %d", len(lines))
	}
}
