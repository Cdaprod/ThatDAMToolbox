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
)

// … your Config & DefaultConfig unchanged …

func RunCaptureLoop(ctx context.Context, cfg Config) error {
    // feature flags:
    enableMP4 := os.Getenv("CAPTURE_ENABLE_MP4") != "false"
    enableHLS := os.Getenv("CAPTURE_ENABLE_HLS") == "true"

    // if neither output is enabled, nothing to do
    if !enableMP4 && !enableHLS {
        log.Printf("[runner] both MP4 & HLS disabled; exiting for %s", cfg.Device)
        return nil
    }

    // ensure directories
    if enableMP4 {
        if err := os.MkdirAll(cfg.OutDir, 0o755); err != nil {
            return fmt.Errorf("failed to create MP4 dir %q: %w", cfg.OutDir, err)
        }
    }
    var hlsBase string
    if enableHLS {
        hlsBase = filepath.Join(os.TempDir(), "hls", filepath.Base(cfg.Device))
        if err := os.MkdirAll(hlsBase, 0o755); err != nil {
            log.Printf("[hls] failed to create dir %q: %v", hlsBase, err)
            enableHLS = false
        }
    }

    // start HLS in background, if enabled
    if enableHLS {
        go func() {
            args := []string{
                "-hide_banner", "-loglevel", "error",
                "-f", "v4l2", "-framerate", fmt.Sprint(cfg.FPS),
                "-video_size", cfg.Resolution,
                "-i", cfg.Device,
                "-c:v", "libx264", "-preset", "veryfast", "-tune", "zerolatency",
                "-f", "hls",
                "-hls_time", "1",
                "-hls_list_size", "3",
                "-hls_flags", "delete_segments+append_list",
                filepath.Join(hlsBase, "index.m3u8"),
            }
            log.Printf("[hls] starting HLS for %s at %s", cfg.Device, hlsBase)
            cmd := exec.CommandContext(ctx, cfg.FFmpegPath, args...)
            if err := cmd.Run(); err != nil {
                log.Printf("[hls] ffmpeg error for HLS %s: %v", cfg.Device, err)
            }
        }()
    }

    fails := 0
    for {
        select {
        case <-ctx.Done():
            log.Printf("[runner] context canceled, stopping capture for %s", cfg.Device)
            return nil
        default:
        }

        // Build MP4 output path
        outFile := buildOutputFilename(cfg)

        // publish "started"
        broker.Publish("capture.recording_started", map[string]any{
            "device":    cfg.Device,
            "file":      outFile,
            "timestamp": time.Now().UTC(),
        })

        // only run MP4 if enabled
        if enableMP4 {
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
            log.Printf("[mp4] starting capture: %s → %s", cfg.Device, outFile)
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
            }
        }

        // publish "stopped" for MP4 (even if MP4 was disabled, you could still signal end-of-segment)
        broker.Publish("capture.recording_stopped", map[string]any{
            "device":    cfg.Device,
            "file":      outFile,
            "timestamp": time.Now().UTC(),
        })

        // wait before retry
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