// /host/services/capture-daemon/runner/ffmpeg.go
package runner

import (
    "encoding/json"
    "log"
    "net/http"
    "sync"
    "time"

    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner"
)

// Config holds the parameters for a single device capture loop.
type Config struct {
    Device      string        // e.g. "/dev/video0"
    Codec       string        // e.g. "h264"
    Resolution  string        // e.g. "1920x1080"
    FPS         int           // e.g. 30
    OutDir      string        // e.g. "/var/media/records"
    FFmpegPath  string        // e.g. "ffmpeg"
    RetryDelay  time.Duration // e.g. 3 * time.Second
}

// DefaultConfig returns a reasonable default Config for the given device.
func DefaultConfig(device string) Config {
    return Config{
        Device:     device,
        Codec:      "h264",
        Resolution: "1920x1080",
        FPS:        30,
        OutDir:     "/var/media/records",
        FFmpegPath: "ffmpeg",
        RetryDelay: 3 * time.Second,
    }
}

// RunCaptureLoop runs ffmpeg in a loop until the ctx is canceled.
// It restarts ffmpeg on error after RetryDelay.
func RunCaptureLoop(ctx context.Context, cfg Config) error {
    // Ensure output directory exists
    if err := os.MkdirAll(cfg.OutDir, 0o755); err != nil {
        return fmt.Errorf("failed to create output dir %q: %w", cfg.OutDir, err)
    }

    for {
        select {
        case <-ctx.Done():
            log.Printf("[ffmpeg] context canceled, stopping capture for %s", cfg.Device)
            return nil
        default:
        }

        outFile := buildOutputFilename(cfg)
        log.Printf("[ffmpeg] starting capture: %s → %s", cfg.Device, outFile)

        // Use a child context so ffmpeg is killed when parent ctx is done
        cmdCtx, cancel := context.WithCancel(ctx)
        args := []string{
            "-hide_banner",
            "-loglevel", "warning",
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

        if err := cmd.Run(); err != nil {
            // If ctx was canceled, exit cleanly
            if ctx.Err() != nil {
                cancel()
                return nil
            }
            log.Printf("[ffmpeg] error capturing %s: %v", cfg.Device, err)
        }

        cancel()

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
    filename := fmt.Sprintf("%s-%s-%s.mp4", base, cfg.Codec, ts)
    return filepath.Join(cfg.OutDir, filename)
}

// Update receives the device list that main.go already discovered.
func (r *Registry) Update(devices []scanner.Device) {
    r.mu.Lock()
    defer r.mu.Unlock()

    seen := make(map[string]struct{})

    // Start runners for newly discovered devices
    for _, d := range devices {
        seen[d.ID] = struct{}{}
        if _, ok := r.devices[d.ID]; !ok {
            log.Printf("➕ Device discovered: %s (%s)", d.ID, d.Name)
            ctl := runner.StartRunner(d.Path)
            r.runners[d.ID] = ctl
        }
        r.devices[d.ID] = Device{
            ID:       d.ID,
            Name:     d.Name,
            LastSeen: time.Now(),
        }
    }

    // Stop runners for devices no longer present
    for id := range r.devices {
        if _, stillThere := seen[id]; !stillThere {
            log.Printf("➖ Device removed: %s", id)
            if ctl, has := r.runners[id]; has {
                close(ctl.StopChan)
                delete(r.runners, id)
            }
            delete(r.devices, id)
        }
    }
}