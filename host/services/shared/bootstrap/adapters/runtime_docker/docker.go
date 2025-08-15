package runtimedocker

import (
	"context"
	"os/exec"

	ports "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/ports"
)

// DockerRuntime manages services using the Docker CLI.
//
// Example:
//
//	rt := runtimedocker.New("")
//	_ = rt.Ensure(ctx, ports.UnitSpec{Name: "busy", Command: []string{"busybox", "true"}})
type DockerRuntime struct{ Bin string }

// New returns a DockerRuntime using the provided binary name.
func New(bin string) DockerRuntime {
	if bin == "" {
		bin = "docker"
	}
	return DockerRuntime{Bin: bin}
}

// Ensure runs the container using `docker run --rm` semantics.
func (d DockerRuntime) Ensure(ctx context.Context, u ports.UnitSpec) error {
	if len(u.Command) == 0 {
		return nil
	}
	args := append([]string{"run", "--rm", "-d", "--name", u.Name}, u.Command...)
	cmd := exec.CommandContext(ctx, d.Bin, args...)
	return cmd.Run()
}

// Stop removes the named container if present.
func (d DockerRuntime) Stop(ctx context.Context, name string) error {
	exec.CommandContext(ctx, d.Bin, "rm", "-f", name).Run()
	return nil
}

// State always reports the unit as inactive. Detailed inspection is TODO.
func (d DockerRuntime) State(ctx context.Context, name string) (ports.UnitState, error) {
	return ports.UnitState{Name: name, Active: false}, nil
}
