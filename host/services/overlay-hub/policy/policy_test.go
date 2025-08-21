package policy

import "testing"

func TestCheck(t *testing.T) {
	p := New()
	if ceiling, ok := p.Check("agent1", "realtime"); !ok || ceiling != 3000 {
		t.Fatalf("expected allowed with ceiling 3000, got %v %d", ok, ceiling)
	}
	if _, ok := p.Check("agent3", "realtime"); ok {
		t.Fatalf("expected agent3 denied")
	}
	if _, ok := p.Check("agent1", "unknown"); ok {
		t.Fatalf("expected unknown class denied")
	}
}
