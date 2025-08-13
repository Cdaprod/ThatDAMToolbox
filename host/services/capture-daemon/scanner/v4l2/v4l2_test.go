package v4l2

import "testing"

// TestDiscoverCompiles ensures Discover executes without panic.
func TestDiscoverCompiles(t *testing.T) {
	_, _ = Discover()
}
