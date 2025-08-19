package executor

import (
	"context"
	"fmt"
	"net/http"
	"os/exec"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor/plan"
)

// Executor applies an App to the local system.
type Executor interface {
	Apply(ctx context.Context, dp plan.DesiredPlan) error
}

// New selects an executor by kind.
func New(kind string) Executor {
	switch kind {
	case "nerdctl":
		return NerdctlCompose{}
	case "systemd":
		return SystemdUnits{}
	case "noop":
		return Noop{}
	default:
		return DockerCompose{}
	}
}

// DockerCompose uses docker compose.
type DockerCompose struct{}

func (DockerCompose) Apply(ctx context.Context, dp plan.DesiredPlan) error {
	return runCompose(ctx, "docker", dp.Apps)
}

// NerdctlCompose uses nerdctl compose.
type NerdctlCompose struct{}

func (NerdctlCompose) Apply(ctx context.Context, dp plan.DesiredPlan) error {
	return runCompose(ctx, "nerdctl", dp.Apps)
}

// SystemdUnits uses systemd units.
type SystemdUnits struct{}

func (SystemdUnits) Apply(ctx context.Context, dp plan.DesiredPlan) error {
	return nil
}

// Noop prints the intended actions.
type Noop struct{}

func (Noop) Apply(ctx context.Context, dp plan.DesiredPlan) error {
	fmt.Printf("[noop] apply %d apps\n", len(dp.Apps))
	return nil
}

func runCompose(ctx context.Context, bin string, apps []plan.AppSpec) error {
	for _, app := range apps {
		args := append([]string{"compose"}, append(app.Command, app.Name)...)
		cmd := exec.CommandContext(ctx, bin, args...)
		cmd.Dir = app.Cwd
		for k, v := range app.Env {
			cmd.Env = append(cmd.Env, k+"="+v)
		}
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("%s %v: %w", bin, args, err)
		}
		if app.Health != nil && app.Health.HTTP != "" {
			if err := waitHealthy(ctx, app.Health.HTTP, app.Health.TimeoutSec, app.Health.IntervalSec); err != nil {
				return err
			}
		}
	}
	return nil
}

func waitHealthy(ctx context.Context, url string, timeout, interval int) error {
	if timeout <= 0 {
		timeout = 30
	}
	if interval <= 0 {
		interval = 3
	}
	deadline := time.Now().Add(time.Duration(timeout) * time.Second)
	client := &http.Client{Timeout: 3 * time.Second}
	for {
		req, _ := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
		resp, err := client.Do(req)
		if err == nil && resp.StatusCode >= 200 && resp.StatusCode < 400 {
			resp.Body.Close()
			return nil
		}
		if resp != nil {
			resp.Body.Close()
		}
		if time.Now().After(deadline) {
			return fmt.Errorf("health timeout: %s", url)
		}
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-time.After(time.Duration(interval) * time.Second):
		}
	}
}
