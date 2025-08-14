package executor

import (
	"context"
	"fmt"

	"github.com/Cdaprod/ThatDamToolbox/host/services/runner/internal/model"
)

// Executor applies an App to the local system.
type Executor interface {
	Apply(ctx context.Context, app model.App) error
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

func (DockerCompose) Apply(ctx context.Context, app model.App) error {
	// TODO implement deterministic compose rendering
	return nil
}

// NerdctlCompose uses nerdctl compose.
type NerdctlCompose struct{}

func (NerdctlCompose) Apply(ctx context.Context, app model.App) error {
	return nil
}

// SystemdUnits uses systemd units.
type SystemdUnits struct{}

func (SystemdUnits) Apply(ctx context.Context, app model.App) error {
	return nil
}

// Noop prints the intended actions.
type Noop struct{}

func (Noop) Apply(ctx context.Context, app model.App) error {
	fmt.Printf("[noop] apply %d services role=%s\n", len(app.Services), app.Role)
	return nil
}
