package webrtc

import "testing"

// TestHWAccelArgs parses FFMPEG_HWACCEL.
func TestHWAccelArgs(t *testing.T) {
	t.Setenv("FFMPEG_HWACCEL", "cuda -hwaccel_device 0")
	args := hwAccelArgs()
	if len(args) != 3 || args[0] != "cuda" {
		t.Fatalf("unexpected args: %v", args)
	}
}
