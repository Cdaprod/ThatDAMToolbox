// host/services/capture-daemon/runner/ffmpeg.go
package runner

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/broker"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/ingest"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/storage"
	"github.com/google/uuid"
)

// Deps groups external services required for ingest.
type Deps struct {
	BlobStore storage.BlobStore
}

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

// isV4L2 reports whether the device path is a local video node.
func isV4L2(path string) bool {
	return strings.HasPrefix(path, "/dev/")
}

// buildInputArgs returns ffmpeg input arguments for the device.
func buildInputArgs(cfg Config) []string {
	if isV4L2(cfg.Device) {
		return []string{
			"-f", "v4l2",
			"-framerate", fmt.Sprint(cfg.FPS),
			"-video_size", cfg.Resolution,
			"-i", cfg.Device,
		}
	}
	return []string{"-i", cfg.Device}
}

// RunCaptureLoop continuously records video from the device using ffmpeg,
// saves to MP4, and broadcasts status via the broker.
// Supports configurable MP4 output and HLS preview via env flags.
func RunCaptureLoop(ctx context.Context, cfg Config, deps Deps) error {
	enableMP4 := strings.EqualFold(os.Getenv("ENABLE_MP4_SERVE"), "true")
	enableHLS := strings.EqualFold(os.Getenv("ENABLE_HLS_PREVIEW"), "true")

	if !enableMP4 && !enableHLS {
		log.Printf("[runner] Both MP4 & HLS output disabled; exiting for %s", cfg.Device)
		return nil
	}

	// Ensure MP4 output directory
	if enableMP4 {
		if err := os.MkdirAll(cfg.OutDir, 0o755); err != nil {
			return fmt.Errorf("failed to create output dir %q: %w", cfg.OutDir, err)
		}
	}

	var hlsBase string
	if enableHLS {
		hlsBase = filepath.Join(os.TempDir(), "hls", filepath.Base(cfg.Device))
		if err := os.MkdirAll(hlsBase, 0o755); err != nil {
			log.Printf("[hls] Failed to create dir %q: %v", hlsBase, err)
			enableHLS = false
		}
	}

	// Start HLS in background, if enabled
	if enableHLS {
		go func() {
			args := append([]string{"-hide_banner", "-loglevel", "error"}, buildInputArgs(cfg)...)
			args = append(args,
				"-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
				"-f", "hls",
				"-hls_time", "1",
				"-hls_list_size", "3",
				"-hls_flags", "delete_segments+append_list",
				filepath.Join(hlsBase, "index.m3u8"),
			)
			log.Printf("[hls] Starting HLS for %s at %s", cfg.Device, hlsBase)
			cmd := exec.CommandContext(ctx, cfg.FFmpegPath, args...)
			_ = cmd.Run() // best-effort, logs only on main loop error
		}()
	}

	fails := 0
	for {
		select {
		case <-ctx.Done():
			log.Printf("[runner] Context canceled, stopping capture for %s", cfg.Device)
			return nil
		default:
		}

		outFile := buildOutputFilename(cfg)
		broker.Publish("capture.recording_started", map[string]any{
			"device":    cfg.Device,
			"file":      outFile,
			"timestamp": time.Now().UTC(),
		})

		if enableMP4 {
			cmdCtx, cancel := context.WithCancel(ctx)
			args := append([]string{"-hide_banner", "-loglevel", "error"}, buildInputArgs(cfg)...)
			args = append(args,
				"-c:v", cfg.Codec,
				"-preset", "veryfast",
				"-tune", "zerolatency",
				outFile,
			)
			cmd := exec.CommandContext(cmdCtx, cfg.FFmpegPath, args...)
			cmd.Stdout = os.Stdout
			cmd.Stderr = os.Stderr

			err := cmd.Run()
			cancel()

			if err != nil {
				if strings.Contains(err.Error(), "Not a tty") {
					log.Printf("[mp4] %s not a v4l2 node, stopping", cfg.Device)
					return nil
				}
				if ctx.Err() != nil {
					broker.Publish("capture.recording_stopped", map[string]any{
						"device":    cfg.Device,
						"file":      outFile,
						"timestamp": time.Now().UTC(),
					})
					return nil
				}
				log.Printf("[mp4] error on %s: %v", cfg.Device, err)
				fails++
				if fails >= 5 {
					log.Printf("[mp4] giving up on %s after %d errors", cfg.Device, fails)
					broker.Publish("capture.recording_stopped", map[string]any{
						"device":    cfg.Device,
						"file":      outFile,
						"timestamp": time.Now().UTC(),
					})
					return nil
				}
			} else {
				fails = 0
				if deps.BlobStore != nil {
					asset, err := ingestRecording(deps, outFile)
					if err == nil {
						broker.Publish("asset.ingested", asset)
					}
				}
			}
		}

		broker.Publish("capture.recording_stopped", map[string]any{
			"device":    cfg.Device,
			"file":      outFile,
			"timestamp": time.Now().UTC(),
		})

		select {
		case <-ctx.Done():
			return nil
		case <-time.After(cfg.RetryDelay):
		}
	}
}

// ingestRecording moves file at path into the blob store and returns a catalog asset.
func ingestRecording(deps Deps, path string) (catalog.Asset, error) {
	f, err := os.Open(path)
	if err != nil {
		return catalog.Asset{}, err
	}
	info, err := f.Stat()
	if err != nil {
		f.Close()
		return catalog.Asset{}, err
	}
	key, hash, _, err := ingest.PutIfAbsent(deps.BlobStore, f)
	f.Close()
	if err != nil {
		return catalog.Asset{}, err
	}
	indexKey, _ := ingest.WriteIndex(deps.BlobStore, hash, 0)
	host, _ := os.Hostname()
	a := catalog.Asset{
		ID:         uuid.NewString(),
		Key:        key,
		Size:       info.Size(),
		Hash:       hash,
		MIME:       "video/mp4",
		Folder:     "recordings",
		CreatedAt:  time.Now().UTC(),
		SourceNode: host,
		OriginPath: path,
		Labels:     map[string]string{"index_key": indexKey},
	}
	_ = os.Remove(path)
	return a, nil
}

// buildOutputFilename constructs a timestamped filename under cfg.OutDir.
func buildOutputFilename(cfg Config) string {
	ts := time.Now().UTC().Format("20060102T150405Z")
	base := filepath.Base(cfg.Device)
	return filepath.Join(cfg.OutDir, fmt.Sprintf("%s-%s-%s.mp4", base, cfg.Codec, ts))
}
