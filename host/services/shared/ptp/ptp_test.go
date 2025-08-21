package ptp

import (
	"testing"
	"time"
)

// TestClockMonotonic ensures Now() yields monotonically increasing values.
func TestClockMonotonic(t *testing.T) {
	base := time.Unix(0, 0)
	c := NewFrom(func() time.Time {
		base = base.Add(time.Millisecond)
		return base
	})
	prev := c.Now()
	for i := 0; i < 5; i++ {
		now := c.Now()
		if !now.After(prev) {
			t.Fatalf("time did not increase: %v >= %v", prev, now)
		}
		prev = now
	}
}

// TestClockOffset ensures Sync applies the expected offset.
func TestClockOffset(t *testing.T) {
	base := time.Unix(0, 0)
	c := NewFrom(func() time.Time { return base })
	ptpTime := base.Add(2 * time.Second)
	c.Sync(ptpTime)
	if got := c.Now(); !got.Equal(ptpTime) {
		t.Fatalf("expected %v, got %v", ptpTime, got)
	}
	if off := c.Offset(); off != 2*time.Second {
		t.Fatalf("expected offset 2s, got %v", off)
	}
}
