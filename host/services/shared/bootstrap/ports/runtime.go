package ports

import "context"

// UnitSpec describes a service unit to run on a node.
//
// Example:
//
//	spec := ports.UnitSpec{Name: "echo", Command: []string{"echo", "hi"}}
//
// This specification can be passed to a ServiceRuntime to ensure the
// service is running.
type UnitSpec struct {
	Name    string            // logical name of the unit
	Command []string          // command and args
	Env     map[string]string // environment variables
	Restart string            // restart policy: "always"|"on-failure"|"no"
}

// UnitState reports the status of a service unit.
type UnitState struct {
	Name     string
	Active   bool
	Pid      int
	ExitCode int
	Message  string
}

// ServiceRuntime abstracts how node services are managed.
//
// Implementations should be idempotent. Calling Ensure multiple times with
// the same UnitSpec must have the same effect.
type ServiceRuntime interface {
	Ensure(ctx context.Context, u UnitSpec) error
	Stop(ctx context.Context, name string) error
	State(ctx context.Context, name string) (UnitState, error)
}
