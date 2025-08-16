package mp4

import (
	"context"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/stream"
)

type adapter struct{}

// New returns a stub adapter for MP4.
func New() stream.Adapter { return adapter{} }

func (adapter) Name() string { return "mp4" }

func (adapter) Open(ctx context.Context, device string) (map[string]any, error) {
	return map[string]any{"proto": "mp4", "device": device}, nil
}

func (adapter) Close(id string) error { return nil }
