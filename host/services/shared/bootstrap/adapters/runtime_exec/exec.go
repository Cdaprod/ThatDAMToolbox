package runtimeexec

import (
	"context"
	"os/exec"
	"sync"
	"time"

	ports "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/ports"
)

// ExecRuntime starts services as local processes.
//
// Example:
//
//	rt := runtimeexec.New()
//	_ = rt.Ensure(ctx, ports.UnitSpec{Name: "sleep", Command: []string{"sleep", "1"}})
type ExecRuntime struct {
	mu    sync.Mutex
	procs map[string]*execProc
}

type execProc struct {
	spec   ports.UnitSpec
	cancel context.CancelFunc
}

// New creates a new ExecRuntime.
func New() *ExecRuntime { return &ExecRuntime{procs: make(map[string]*execProc)} }

// Ensure starts the process described by the unit specification and restarts
// it according to the Restart policy.
func (rt *ExecRuntime) Ensure(ctx context.Context, u ports.UnitSpec) error {
	if len(u.Command) == 0 {
		return nil
	}
	rt.mu.Lock()
	if _, ok := rt.procs[u.Name]; ok {
		rt.mu.Unlock()
		return nil
	}
	cctx, cancel := context.WithCancel(context.Background())
	p := &execProc{spec: u, cancel: cancel}
	rt.procs[u.Name] = p
	rt.mu.Unlock()
	go rt.run(cctx, p)
	return nil
}

func (rt *ExecRuntime) run(ctx context.Context, p *execProc) {
	backoff := time.Second
	for {
		cmd := exec.CommandContext(ctx, p.spec.Command[0], p.spec.Command[1:]...)
		cmd.Env = append(cmd.Env, formatEnv(p.spec.Env)...)
		_ = cmd.Run()
		if p.spec.Restart != "always" || ctx.Err() != nil {
			return
		}
		time.Sleep(backoff)
		if backoff < 30*time.Second {
			backoff *= 2
		}
	}
}

// Stop stops a tracked process if running.
func (rt *ExecRuntime) Stop(ctx context.Context, name string) error {
	rt.mu.Lock()
	p, ok := rt.procs[name]
	if ok {
		p.cancel()
		delete(rt.procs, name)
	}
	rt.mu.Unlock()
	return nil
}

// State reports whether a process is being tracked.
func (rt *ExecRuntime) State(ctx context.Context, name string) (ports.UnitState, error) {
	rt.mu.Lock()
	_, ok := rt.procs[name]
	rt.mu.Unlock()
	return ports.UnitState{Name: name, Active: ok, ExitCode: 0}, nil
}

func formatEnv(m map[string]string) []string {
	env := make([]string, 0, len(m))
	for k, v := range m {
		env = append(env, k+"="+v)
	}
	return env
}
