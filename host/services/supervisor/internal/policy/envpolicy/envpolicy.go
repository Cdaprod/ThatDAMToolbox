// Package envpolicy provides an environment-driven Policy implementation.
package envpolicy

import (
	"context"
	"os"
	"strconv"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// EnvPolicy implements ports.Policy using environment variables for simple feature flags.
type EnvPolicy struct {
	AllowAnonymousProxy     bool
	RequireAuthForPlan      bool
	RequireAuthForBootstrap bool
}

// NewFromEnv builds an EnvPolicy from environment variables.
// Example:
//
//	POLICY_ALLOW_ANONYMOUS_PROXY=1 supervisor
func NewFromEnv() EnvPolicy {
	return EnvPolicy{
		AllowAnonymousProxy:     getBool("POLICY_ALLOW_ANONYMOUS_PROXY"),
		RequireAuthForPlan:      getBool("POLICY_REQUIRE_AUTH_FOR_PLAN"),
		RequireAuthForBootstrap: getBool("POLICY_REQUIRE_AUTH_FOR_BOOTSTRAP"),
	}
}

func getBool(k string) bool {
	v, _ := strconv.ParseBool(os.Getenv(k))
	return v
}

// Allow decides if the principal may perform the given action.
func (e EnvPolicy) Allow(_ context.Context, p ports.Principal, a ports.Action) bool {
	// Unauthenticated principals
	if p.Sub == "" {
		switch a {
		case ports.ActPlan:
			return !e.RequireAuthForPlan
		case ports.ActRegister:
			return e.AllowAnonymousProxy
		default:
			return false
		}
	}
	switch a {
	case ports.ActRegister, ports.ActHeartbeat:
		return p.Scopes["thatdam:register"]
	case ports.ActPlan:
		return p.Scopes["thatdam:read"]
	case ports.ActBootstrap:
		if e.RequireAuthForBootstrap {
			return p.Scopes["thatdam:apply"]
		}
		return true
	case ports.ActLeader:
		return p.Scopes["thatdam:admin"]
	default:
		return false
	}
}

// Flags exposes feature flags relevant to plan shaping.
func (e EnvPolicy) Flags(_ context.Context) map[string]bool {
	return map[string]bool{
		"allowAnonymousProxy": e.AllowAnonymousProxy,
		"requireAuthForPlan":  e.RequireAuthForPlan,
	}
}
