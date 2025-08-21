package ptp

import (
	"sync"
	"time"
)

// Clock provides monotonic timestamps adjusted by an optional PTP offset.
type Clock struct {
	mu     sync.RWMutex
	offset time.Duration
	nowFn  func() time.Time
}

// New returns a Clock using the system clock.
func New() *Clock {
	return &Clock{nowFn: time.Now}
}

// NewFrom allows supplying a custom time source (mainly for tests).
func NewFrom(fn func() time.Time) *Clock {
	return &Clock{nowFn: fn}
}

// Now returns the current time adjusted by the offset.
func (c *Clock) Now() time.Time {
	c.mu.RLock()
	off := c.offset
	c.mu.RUnlock()
	return c.nowFn().Add(off)
}

// Sync updates the clock offset based on a PTP timestamp.
// The provided ptpTime is expected to be in the same timebase as time.Now().
func (c *Clock) Sync(ptpTime time.Time) {
	now := c.nowFn()
	c.mu.Lock()
	c.offset = ptpTime.Sub(now)
	c.mu.Unlock()
}

// Offset returns the currently applied PTP offset.
func (c *Clock) Offset() time.Duration {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.offset
}
