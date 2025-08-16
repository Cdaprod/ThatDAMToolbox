package runtimeexec

import (
	"context"
	"os/exec"

	ports "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/ports"
)

// ExecRuntime starts services as local processes.
//
// Example:
//
//	rt := runtimeexec.New()
//	_ = rt.Ensure(ctx, ports.UnitSpec{Name: "sleep", Command: []string{"sleep", "1"}})
type ExecRuntime struct{}

// New creates a new ExecRuntime.
func New() ExecRuntime { return ExecRuntime{} }

// Ensure starts the process described by the unit specification.
// It returns once the command has been started.
func (ExecRuntime) Ensure(ctx context.Context, u ports.UnitSpec) error {
	if len(u.Command) == 0 {
		return nil
	}
	cmd := exec.CommandContext(ctx, u.Command[0], u.Command[1:]...)
	cmd.Env = append(cmd.Env, formatEnv(u.Env)...)
	return cmd.Start()
}

// Stop is a no-op for ExecRuntime since processes are not tracked.
func (ExecRuntime) Stop(ctx context.Context, name string) error { return nil }

// State always reports the unit as inactive because processes are not tracked.
func (ExecRuntime) State(ctx context.Context, name string) (ports.UnitState, error) {
	return ports.UnitState{Name: name, Active: false}, nil
}

func formatEnv(m map[string]string) []string {
	env := make([]string, 0, len(m))
	for k, v := range m {
		env = append(env, k+"="+v)
	}
	return env
}
