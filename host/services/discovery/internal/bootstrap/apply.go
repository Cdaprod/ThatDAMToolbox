package bootstrap

import (
	"context"
	"errors"
)

// Engine applies a bootstrap profile to the local node.
//
// Any type implementing Apply can be used, allowing callers to pass
// concrete reconcilers.
type Engine interface {
	Apply(ctx context.Context, profile any) error
}

// Apply reconciles the given profile using the supplied engine.
//
// Example:
//
//	err := Apply(context.Background(), engine, profile)
//	if err != nil {
//	    // handle error
//	}
//
// A nil engine returns an error. The profile parameter is intentionally
// untyped so that this package remains decoupled from specific profile
// definitions.
func Apply(ctx context.Context, eng Engine, profile any) error {
	if eng == nil {
		return errors.New("engine is nil")
	}
	if ctx == nil {
		ctx = context.Background()
	}
	return eng.Apply(ctx, profile)
}
