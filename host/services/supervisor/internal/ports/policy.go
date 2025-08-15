// Package ports defines interfaces for supervisor dependencies.
package ports

import "context"

// Principal represents an authenticated subject with granted scopes and roles.
type Principal struct {
	Sub    string
	Scopes map[string]bool
	Roles  []string
}

// Action enumerates operations that require authorization checks.
type Action string

const (
	ActRegister  Action = "register"
	ActPlan      Action = "plan.read"
	ActHeartbeat Action = "heartbeat"
	ActBootstrap Action = "bootstrap.apply"
	ActLeader    Action = "leader.claim"
)

// Policy decides if a principal may perform an action and exposes feature flags.
type Policy interface {
	Allow(ctx context.Context, p Principal, a Action) bool
	Flags(ctx context.Context) map[string]bool
}
