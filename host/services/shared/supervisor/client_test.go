package supervisor

import (
	"context"
	"os"
	"testing"
)

func TestNoop(t *testing.T) {
	os.Unsetenv("SUPERVISOR_URL")
	if err := Register(context.Background(), Agent{ID: "x"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if err := Heartbeat(context.Background(), "x"); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}
