// /host/services/capture-daemon/runner/ffmpeg.go
package runner

import (
    "log"
    "os"
    "os/exec"
    "path/filepath"
    "time"
)

type FFmpegConfig struct {
    Device   string
    Codec    string
    Res      string
    Fps      string
    OutDir   string
    FfmpegPath string
}

func DefaultFFmpegConfig(device string) FFmpegConfig {
    return FFmpegConfig{
        Device:   device,
        Codec:    "h264",
        Res:      "1920x1080",
        Fps:      "30",
        OutDir:   "/var/media/records",
        FfmpegPath: "ffmpeg",
    }
}

func ensureDir(dir string) error {
    return os.MkdirAll(dir, 0755)
}

func buildOutputFilename(cfg FFmpegConfig) string {
    timestamp := time.Now().UTC().Format("20060102T150405Z")
    devName := filepath.Base(cfg.Device)
    return filepath.Join(cfg.OutDir, devName+"-"+cfg.Codec+"-"+timestamp+".mp4")
}

func RunFFmpegLoop(cfg FFmpegConfig, stop <-chan struct{}) {
    _ = ensureDir(cfg.OutDir)
    for {
        select {
        case <-stop:
            log.Printf("[ffmpeg] Stopping capture for %s", cfg.Device)
            return
        default:
        }
        outFile := buildOutputFilename(cfg)
        log.Printf("[ffmpeg] Starting capture: %s → %s", cfg.Device, outFile)
        err := runFFmpegOnce(cfg, outFile)
        if err != nil {
            log.Printf("[ffmpeg] Capture error on %s: %v", cfg.Device, err)
        }
        time.Sleep(3 * time.Second)
    }
}

func runFFmpegOnce(cfg FFmpegConfig, outFile string) error {
    args := []string{
        "-hide_banner", "-loglevel", "warning",
        "-f", "v4l2",
        "-framerate", cfg.Fps,
        "-video_size", cfg.Res,
        "-i", cfg.Device,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-tune", "zerolatency",
        outFile,
    }
    cmd := exec.Command(cfg.FfmpegPath, args...)
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    return cmd.Run()
}