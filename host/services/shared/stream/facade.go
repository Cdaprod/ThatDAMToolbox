package stream

import (
	"context"
	"errors"
	"github.com/google/uuid"
)

// Factory resolves adapters by protocol name; override in callers.
var Factory func(string) Adapter

// lookup retrieves device capabilities; replace in callers/tests.
var lookup = func(id string) Capabilities { return Capabilities{} }

// CreateSession negotiates a streaming session using Factory.
func CreateSession(ctx context.Context, r Request) (Session, error) {
	caps := lookup(r.Device)
	if len(caps.Protos) == 0 {
		return Session{}, errors.New("device not found")
	}
	if Factory == nil {
		return Session{}, errors.New("no factory")
	}
	ad, rest := selectAdapter(r.Prefer, caps, Factory)
	details, err := ad.Open(ctx, r.Device)
	if err != nil {
		return Session{}, err
	}
	return Session{ID: uuid.NewString(), Proto: ad.Name(), Details: details, Fallback: rest}, nil
}

// CloseSession delegates to adapter; not implemented for stub.
func CloseSession(id string) error { return nil }
