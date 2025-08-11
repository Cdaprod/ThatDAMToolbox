package v4l2probe

import "testing"

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
