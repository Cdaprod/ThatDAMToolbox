package plan

// Package plan defines desired application plans exchanged between
// supervisor and agents. Plans describe which applications should run on
// a node and how to build or health check them.

// HealthCheck defines an HTTP health endpoint with polling intervals.
type HealthCheck struct {
	HTTP        string `json:"http,omitempty"`
	IntervalSec int    `json:"interval_sec,omitempty"`
	TimeoutSec  int    `json:"timeout_sec,omitempty"`
}

// BuildKind enumerates supported build types.
type BuildKind string

const (
	BuildNone   BuildKind = "none"
	BuildNextJS BuildKind = "nextjs"
)

// BuildSpec describes how an application should be built before running.
type BuildSpec struct {
	Kind     BuildKind         `json:"kind"`
	Strategy string            `json:"strategy,omitempty"`
	Command  []string          `json:"command,omitempty"`
	OutDir   string            `json:"out_dir,omitempty"`
	Env      map[string]string `json:"env,omitempty"`
}

// AppSpec describes a single application to run as part of a plan.
type AppSpec struct {
	Name    string            `json:"name"`
	Kind    string            `json:"kind"`
	Cwd     string            `json:"cwd"`
	Command []string          `json:"command"`
	Env     map[string]string `json:"env,omitempty"`
	Ports   []int             `json:"ports,omitempty"`
	After   []string          `json:"after,omitempty"`
	Restart string            `json:"restart,omitempty"`
	Health  *HealthCheck      `json:"health,omitempty"`
	Build   *BuildSpec        `json:"build,omitempty"`
}

// DesiredPlan represents the applications an agent should run.
type DesiredPlan struct {
	Version  int       `json:"version"`
	Node     string    `json:"node"`
	Executor string    `json:"executor,omitempty"`
	Apps     []AppSpec `json:"apps"`
}
