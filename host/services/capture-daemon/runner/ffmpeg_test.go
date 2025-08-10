// /host/services/capture-daemon/runner/ffmpeg_test.go
package runner

import "testing"

// TestBuildInputArgs verifies v4l2 and network inputs.
func TestBuildInputArgs(t *testing.T) {
	v4 := Config{Device: "/dev/video0", FPS: 30, Resolution: "640x480"}
	net := Config{Device: "rtsp://cam/stream"}
	v4Args := buildInputArgs(v4)
	netArgs := buildInputArgs(net)
	if len(v4Args) == 0 || v4Args[0] != "-f" {
		t.Fatalf("expected v4l2 args, got %v", v4Args)
	}
	if len(netArgs) != 2 || netArgs[0] != "-i" {
		t.Fatalf("expected network args, got %v", netArgs)
	}
}
