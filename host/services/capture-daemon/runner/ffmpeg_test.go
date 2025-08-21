// /host/services/capture-daemon/runner/ffmpeg_test.go
package runner

import (
	"strings"
	"testing"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/ptp"
)

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

// TestBuildOutputFilename uses the provided clock for timestamps.
func TestBuildOutputFilename(t *testing.T) {
	clk := ptp.NewFrom(func() time.Time { return time.Unix(0, 0) })
	name := buildOutputFilename(Config{Device: "/dev/video0", Codec: "h264", OutDir: "/tmp"}, clk)
	if !strings.Contains(name, "19700101T000000Z") {
		t.Fatalf("timestamp not applied: %s", name)
	}
}
