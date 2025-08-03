package runner

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"time"
	"strings"

	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/broker"
)

// Config holds the parameters for a single device capture loop.
type Config struct {
	Device     string        // e.g. "/dev/video0"
	Codec      string        // e.g. "h264"
	Resolution string        // e.g. "1920x1080"
	FPS        int           // e.g. 30
	OutDir     string        // e.g. "/var/media/records"
	FFmpegPath string        // e.g. "ffmpeg"
	RetryDelay time.Duration // e.g. 3 * time.Second
}

// DefaultConfig returns a reasonable default Config for the given device.
func DefaultConfig(device string) Config {
	return Config{
		Device:     device,
		Codec:      "h264",
		Resolution: "1920x1080",
		FPS:        30,
		OutDir:     ResolveOutDir(),
		FFmpegPath: "ffmpeg",
		RetryDelay: 3 * time.Second,
	}
}

// RunCaptureLoop runs ffmpeg in a loop until ctx is cancelled.
// It restarts ffmpeg on error after RetryDelay, but gives up after 5 consecutive failures.
func RunCaptureLoop(ctx context.Context, cfg Config) error {
	// Ensure output directory exists
	if err := os.MkdirAll(cfg.OutDir, 0o755); err != nil {
		return fmt.Errorf("failed to create output dir %q: %w", cfg.OutDir, err)
	}

	fails := 0

	for {
		select {
		case <-ctx.Done():
			log.Printf("[ffmpeg] context canceled, stopping capture for %s", cfg.Device)
			return nil
		default:
		}

		// Build output file path
		outFile := buildOutputFilename(cfg)
		log.Printf("[ffmpeg] starting capture: %s → %s", cfg.Device, outFile)

		// ── notify → capture.recording_started ────────────────────────────
		broker.Publish("capture.recording_started", map[string]any{
			"device":    cfg.Device,
			"file":      outFile,
			"timestamp": time.Now().UTC(),
		})

		// Launch ffmpeg under a child context
		cmdCtx, cancel := context.WithCancel(ctx)
		args := []string{
			"-hide_banner",
			"-loglevel", "error",
			"-f", "v4l2",
			"-framerate", fmt.Sprint(cfg.FPS),
			"-video_size", cfg.Resolution,
			"-i", cfg.Device,
			"-c:v", cfg.Codec,
			"-preset", "veryfast",
			"-tune", "zerolatency",
			outFile,
		}
		cmd := exec.CommandContext(cmdCtx, cfg.FFmpegPath, args...)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		err := cmd.Run()
		cancel()

 		if err != nil {
 			// If the device isn’t a real V4L2 capture node, bail out
 			if strings.Contains(err.Error(), "Not a tty") {
 				log.Printf("[ffmpeg] %s does not support v4l2 capture (Not a tty), stopping", cfg.Device)
 				return nil
 			}
 			
			if ctx.Err() != nil {
				// Normal shutdown
				broker.Publish("capture.recording_stopped", map[string]any{
					"device":    cfg.Device,
					"file":      outFile,
					"timestamp": time.Now().UTC(),
				})
				return nil
			}
			
			log.Printf("[ffmpeg] error capturing %s: %v", cfg.Device, err)

			// Count failures and bail out after 5
			fails++
			if fails >= 5 {
				log.Printf("[ffmpeg] giving up on %s after %d errors", cfg.Device, fails)
				broker.Publish("capture.recording_stopped", map[string]any{
					"device":    cfg.Device,
					"file":      outFile,
					"timestamp": time.Now().UTC(),
				})
				return nil
			}
			
		} else {
			// Reset on success
			fails = 0
		}

		// ── notify → capture.recording_stopped ────────────────────────────
		broker.Publish("capture.recording_stopped", map[string]any{
			"device":    cfg.Device,
			"file":      outFile,
			"timestamp": time.Now().UTC(),
		})

		// Pause before retrying
		select {
		case <-ctx.Done():
			return nil
		case <-time.After(cfg.RetryDelay):
		}
	}
}

// buildOutputFilename constructs a timestamped filename under cfg.OutDir.
func buildOutputFilename(cfg Config) string {
	ts := time.Now().UTC().Format("20060102T150405Z")
	base := filepath.Base(cfg.Device)
	return filepath.Join(cfg.OutDir, fmt.Sprintf("%s-%s-%s.mp4", base, cfg.Codec, ts))
}