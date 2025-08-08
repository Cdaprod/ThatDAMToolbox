package stream

import "context"

// Adapter creates and manages protocol specific sessions.
type Adapter interface {
	Open(ctx context.Context, device string) (map[string]any, error)
	Close(id string) error
	Name() string
}
