package stream

import (
	"context"
	"testing"
)

type stubAdapter struct{ name string }

func (s stubAdapter) Open(ctx context.Context, device string) (map[string]any, error) {
	return map[string]any{"device": device}, nil
}
func (s stubAdapter) Close(id string) error { return nil }
func (s stubAdapter) Name() string          { return s.name }

func TestCreateSessionChoosesFirstAvailable(t *testing.T) {
	lookup = func(id string) Capabilities { return Capabilities{Protos: []string{"hls", "mjpeg"}} }
	Factory = func(p string) Adapter {
		return stubAdapter{name: p}
	}
	sess, err := CreateSession(context.Background(), Request{Device: "dev0", Prefer: []string{"webrtc", "hls", "mjpeg"}})
	if err != nil {
		t.Fatalf("CreateSession: %v", err)
	}
	if sess.Proto != "hls" {
		t.Fatalf("expected hls got %s", sess.Proto)
	}
	if len(sess.Fallback) != 1 || sess.Fallback[0] != "mjpeg" {
		t.Fatalf("unexpected fallback %#v", sess.Fallback)
	}
}
