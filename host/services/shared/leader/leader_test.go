package leader

import (
	"context"
	"testing"
	"time"
)

// TestTryBecomeLeaderNoBroker ensures error returned when broker unreachable.
func TestTryBecomeLeaderNoBroker(t *testing.T) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	if ld, ok, err := TryBecomeLeader(ctx, "amqp://invalid", "test"); err == nil || ld != nil || ok {
		t.Fatalf("expected error without broker, got %v %v %v", ld, ok, err)
	}
}
