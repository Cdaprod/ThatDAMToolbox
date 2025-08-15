//go:build linux

package runtimens

import (
	"context"

	ports "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/ports"
)

// NSRuntime is a placeholder for namespace based isolation.
type NSRuntime struct{ Rootfs string }

// New creates a new NSRuntime.
func New(rootfs string) NSRuntime { return NSRuntime{Rootfs: rootfs} }

// Ensure currently does nothing and succeeds.
func (NSRuntime) Ensure(ctx context.Context, u ports.UnitSpec) error { return nil }

// Stop currently does nothing and succeeds.
func (NSRuntime) Stop(ctx context.Context, name string) error { return nil }

// State reports the unit as inactive.
func (NSRuntime) State(ctx context.Context, name string) (ports.UnitState, error) {
	return ports.UnitState{Name: name, Active: false}, nil
}
