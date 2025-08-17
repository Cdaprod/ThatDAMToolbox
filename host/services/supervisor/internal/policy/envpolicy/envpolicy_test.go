package envpolicy

import (
	"context"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/supervisor/internal/ports"
)

// Test Allow logic for anonymous and scoped principals.
func TestEnvPolicyAllow(t *testing.T) {
	p := EnvPolicy{AllowAnonymousProxy: true}
	if !p.Allow(context.Background(), ports.Principal{}, ports.ActRegister) {
		t.Fatal("anonymous register should be allowed")
	}
	if !p.Allow(context.Background(), ports.Principal{}, ports.ActPlan) {
		t.Fatal("anonymous plan should be allowed when auth not required")
	}
	p.RequireAuthForPlan = true
	if p.Allow(context.Background(), ports.Principal{}, ports.ActPlan) {
		t.Fatal("anonymous plan should be denied when auth required")
	}
	authP := ports.Principal{Sub: "n1", Scopes: map[string]bool{"thatdam:read": true}}
	if !p.Allow(context.Background(), authP, ports.ActPlan) {
		t.Fatal("scoped principal should be allowed")
	}
}
