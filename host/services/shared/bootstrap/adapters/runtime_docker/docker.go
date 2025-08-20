package runtimedocker

import (
	"context"
	"encoding/json"
	"os/exec"
	"strings"

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

// State inspects the container and reports its status.
//
// Example:
//
//	st, _ := rt.State(ctx, "busy")
//	fmt.Println(st.Active)
//
// The function uses `docker inspect` to determine whether the container is
// running and captures the PID, exit code, and status message.
func (d DockerRuntime) State(ctx context.Context, name string) (ports.UnitState, error) {
	cmd := exec.CommandContext(ctx, d.Bin, "inspect", name, "--format", "{{json .State}}")
	out, err := cmd.Output()
	if err != nil {
		return ports.UnitState{Name: name, Active: false, Message: strings.TrimSpace(err.Error())}, nil
	}
	var s struct {
		Running  bool   `json:"Running"`
		Pid      int    `json:"Pid"`
		ExitCode int    `json:"ExitCode"`
		Status   string `json:"Status"`
	}
	if err := json.Unmarshal(out, &s); err != nil {
		return ports.UnitState{Name: name, Active: false, Message: err.Error()}, err
	}
	return ports.UnitState{
		Name:     name,
		Active:   s.Running,
		Pid:      s.Pid,
		ExitCode: s.ExitCode,
		Message:  s.Status,
	}, nil
}
