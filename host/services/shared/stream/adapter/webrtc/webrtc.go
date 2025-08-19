package webrtc

import (
	"context"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/stream"
)

type adapter struct{}

// New returns a stub adapter for WebRTC.
func New() stream.Adapter { return adapter{} }

func (adapter) Name() string { return "webrtc" }

func (adapter) Open(ctx context.Context, device string) (map[string]any, error) {
	return map[string]any{"proto": "webrtc", "device": device}, nil
}

func (adapter) Close(id string) error { return nil }
