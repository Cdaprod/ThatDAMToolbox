package hls

import (
	"context"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/stream"
)

type adapter struct{}

// New returns a stub adapter for HLS.
func New() stream.Adapter { return adapter{} }

func (adapter) Name() string { return "hls" }

func (adapter) Open(ctx context.Context, device string) (map[string]any, error) {
	return map[string]any{"proto": "hls", "device": device}, nil
}

func (adapter) Close(id string) error { return nil }
