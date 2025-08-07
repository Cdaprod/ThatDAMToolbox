package mjpeg

import (
	"context"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/stream"
)

type adapter struct{}

// New returns a stub adapter for MJPEG.
func New() stream.Adapter { return adapter{} }

func (adapter) Name() string { return "mjpeg" }

func (adapter) Open(ctx context.Context, device string) (map[string]any, error) {
	return map[string]any{"proto": "mjpeg", "device": device}, nil
}

func (adapter) Close(id string) error { return nil }
