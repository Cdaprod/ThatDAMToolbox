package v4l2probe

import (
        "context"
        "testing"
        "time"
)

// TestClassify verifies classification logic for defaults.
func TestClassify(t *testing.T) {
	opt := DefaultOptions()

	if kind, ok := classify("pispbe-scaler", V4L2_CAP_VIDEO_CAPTURE, 0, opt); ok || kind != "ignored-internal-pipeline" {
		t.Fatalf("expected ignore pispbe, got %q ok=%v", kind, ok)
	}

	if kind, ok := classify("USB 4K Camera", V4L2_CAP_VIDEO_CAPTURE, 0, opt); !ok || kind != "capture" {
		t.Fatalf("expected capture, got %q ok=%v", kind, ok)
	}

	if kind, ok := classify("rpivid-decoder", V4L2_CAP_VIDEO_M2M, 0, opt); !ok || kind != "m2m-decoder" {
		t.Fatalf("expected m2m-decoder, got %q ok=%v", kind, ok)
	}
}

// TestDiscoverStreamCancel ensures DiscoverStream terminates when the context is
// already cancelled and closes channels without blocking.
func TestDiscoverStreamCancel(t *testing.T) {
        ctx, cancel := context.WithCancel(context.Background())
        cancel()
        keptCh, dropCh, errCh := DiscoverStream(ctx, DefaultOptions())

        select {
        case err := <-errCh:
                if err == nil {
                        t.Fatalf("expected error when context cancelled")
                }
        case <-time.After(100 * time.Millisecond):
                t.Fatalf("timed out waiting for error")
        }

        // Channels should be closed; reading should not block and must yield no values.
        select {
        case _, ok := <-keptCh:
                if ok {
                        t.Fatalf("kept channel should be closed")
                }
        default:
        }
        select {
        case _, ok := <-dropCh:
                if ok {
                        t.Fatalf("dropped channel should be closed")
                }
        default:
        }
}
