package manager

// Applier executes a DesiredPlan using the available runtime adapters.
//
// Example:
//   a := NewApplier("exec")
//   _ = a.Apply(ctx, dp)

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"os/exec"
	"strings"
	"time"

	runtimedocker "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/adapters/runtime_docker"
	runtimeexec "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/adapters/runtime_exec"
	runtimens "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/adapters/runtime_ns"
	runtimeports "github.com/Cdaprod/ThatDamToolbox/host/services/shared/bootstrap/ports"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor/plan"
)

type Applier struct{ rt runtimeports.ServiceRuntime }

// NewApplier selects a runtime based on executor hint.
func NewApplier(executor string) Applier {
	switch executor {
	case "docker":
		return Applier{rt: runtimedocker.New("")}
	case "ns":
		return Applier{rt: runtimens.New("/")}
	default:
		return Applier{rt: runtimeexec.New()}
	}
}

// Apply runs all applications in the desired plan honoring dependencies.
func (a Applier) Apply(ctx context.Context, dp plan.DesiredPlan) error {
	done := map[string]bool{}
	for len(done) < len(dp.Apps) {
		progress := false
		for _, app := range dp.Apps {
			if done[app.Name] {
				continue
			}
			if !depsReady(app.After, done) {
				continue
			}
			if err := a.applyOne(ctx, app); err != nil {
				return fmt.Errorf("%s: %w", app.Name, err)
			}
			done[app.Name] = true
			progress = true
		}
		if !progress {
			return errors.New("plan dependency deadlock")
		}
	}
	return nil
}

func depsReady(ds []string, done map[string]bool) bool {
	for _, d := range ds {
		if !done[d] {
			return false
		}
	}
	return true
}

func (a Applier) applyOne(ctx context.Context, app plan.AppSpec) error {
	if app.Build != nil && app.Build.Kind == plan.BuildNextJS {
		if err := buildNext(ctx, app); err != nil {
			return err
		}
	}
	spec := runtimeports.UnitSpec{Name: app.Name, Command: app.Command, Env: app.Env, Restart: app.Restart}
	if err := a.rt.Ensure(ctx, spec); err != nil {
		return err
	}
	if app.Health != nil && app.Health.HTTP != "" {
		deadline := time.Now().Add(dsec(max(app.Health.TimeoutSec, 30)))
		for time.Now().Before(deadline) {
			if httpOK(app.Health.HTTP) {
				logx.L.Info("healthy", "app", app.Name)
				return nil
			}
			time.Sleep(dsec(max(app.Health.IntervalSec, 3)))
		}
		return fmt.Errorf("health timeout: %s", app.Health.HTTP)
	}
	return nil
}

func httpOK(url string) bool {
	c := &http.Client{Timeout: 3 * time.Second}
	resp, err := c.Get(url)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode >= 200 && resp.StatusCode < 300
}

func buildNext(ctx context.Context, app plan.AppSpec) error {
	if _, err := exec.LookPath("node"); err == nil {
		for _, c := range [][]string{app.Build.Command, {"npm", "run", "build"}} {
			if len(c) == 0 {
				continue
			}
			cmd := exec.CommandContext(ctx, c[0], c[1:]...)
			cmd.Dir = app.Cwd
			for k, v := range app.Build.Env {
				cmd.Env = append(cmd.Env, k+"="+v)
			}
			if err := cmd.Run(); err != nil {
				return err
			}
		}
		return nil
	}
	if _, err := exec.LookPath("docker"); err == nil {
		sh := "set -e; " + strJoin(app.Build.Command) + "; npm run build"
		args := []string{"run", "--rm", "-v", app.Cwd + ":/work", "-w", "/work"}
		for k, v := range app.Build.Env {
			args = append(args, "-e", k+"="+v)
		}
		args = append(args, "node:20-alpine", "sh", "-lc", sh)
		cmd := exec.CommandContext(ctx, "docker", args...)
		return cmd.Run()
	}
	return exec.ErrNotFound
}

func strJoin(cmd []string) string {
	if len(cmd) == 0 {
		return ""
	}
	return fmt.Sprintf("%s %s", cmd[0], strings.Join(cmd[1:], " "))
}

func dsec(n int) time.Duration { return time.Duration(n) * time.Second }
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
