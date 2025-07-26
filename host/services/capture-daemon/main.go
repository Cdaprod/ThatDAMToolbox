package main

import (
    "fmt"
    "log"
    "os"
    "os/exec"
    "path/filepath"
    "time"
)

// Configurable params
var (
    defaultDevice   = "/dev/video0"
    defaultCodec    = "h264"
    defaultRes      = "1920x1080"
    defaultFps      = "30"  // Changed to string
    defaultOutDir   = "/var/media/records"
    ffmpegPath      = "ffmpeg"
)

// ensureDir creates output directory if not present.
func ensureDir(dir string) {
    if err := os.MkdirAll(dir, 0755); err != nil {
        log.Fatalf("Failed to create output dir: %v", err)
    }
}

// buildOutputFilename generates a timestamped output filename for the device.
func buildOutputFilename(device string) string {
    timestamp := time.Now().UTC().Format("20060102T150405Z")
    devName := filepath.Base(device)
    return filepath.Join(defaultOutDir, devName+"-"+defaultCodec+"-"+timestamp+".mp4")
}

// runFFmpeg runs ffmpeg as a subprocess and blocks until it exits or is killed.
func runFFmpeg(device, outFile string) error {
    args := []string{
        "-hide_banner", "-loglevel", "warning",
        "-f", "v4l2",
        "-framerate", defaultFps,
        "-video_size", defaultRes,
        "-i", device,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-tune", "zerolatency",
        outFile,
    }
    cmd := exec.Command(ffmpegPath, args...)
    cmd.Stdout = os.Stdout
    cmd.Stderr = os.Stderr
    return cmd.Run()
}

func main() {
    device := defaultDevice
    if len(os.Args) > 1 {
        device = os.Args[1]
    }

    ensureDir(defaultOutDir)

    for {
        outFile := buildOutputFilename(device)
        log.Printf("Starting capture: %s → %s\n", device, outFile)
        err := runFFmpeg(device, outFile)
        if err != nil {
            log.Printf("Capture error: %v", err)
        }
        time.Sleep(3 * time.Second) // Wait before restarting
    }
}