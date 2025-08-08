package webrtc

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/pion/webrtc/v3"
	"github.com/pion/webrtc/v3/pkg/media"
)

// StreamH264FromFFmpeg launches ffmpeg and forwards raw H264 samples to the provided track.
func StreamH264FromFFmpeg(ctx context.Context, device string, fps int, res string, track *webrtc.TrackLocalStaticSample) error {
	args := append(hwAccelArgs(), "-f", "v4l2", "-framerate", fmt.Sprint(fps),
		"-video_size", res, "-i", device,
		"-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
		"-f", "h264", "pipe:1")
	cmd := exec.CommandContext(ctx, "ffmpeg", args...)
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	if err := cmd.Start(); err != nil {
		return err
	}

	buf := make([]byte, 1<<20) // 1MB buffer
	frameDur := time.Second / time.Duration(fps)
	for {
		n, err := stdout.Read(buf)
		if err != nil {
			if err == io.EOF || ctx.Err() != nil {
				return nil
			}
			return err
		}
		if track != nil {
			data := make([]byte, n)
			copy(data, buf[:n])
			_ = track.WriteSample(media.Sample{Data: data, Duration: frameDur})
		}
	}
}

// hwAccelArgs returns ffmpeg arguments from FFMPEG_HWACCEL.
func hwAccelArgs() []string {
	if v := os.Getenv("FFMPEG_HWACCEL"); v != "" {
		return strings.Fields(v)
	}
	return nil
}
