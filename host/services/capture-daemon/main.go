// /host/services/capture-daemon/main.go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "path/filepath"
    "strings"
    "syscall"
    "time"

    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/api"
    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/broker"
    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/registry"
    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/runner"
    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner"
    _ "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner/v4l2"
)

func main() {
    log.Println("🔌 ThatDamToolbox capture-daemon starting…")

    // 1. Initialize RabbitMQ and broadcast service‐up and schema messages.
    broker.Init()
    broker.Publish("capture.service_up", map[string]any{"ts": time.Now().Unix()})
    broker.PublishSchemas()

    // 2. Create a cancellable root context.
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // 3. Trap SIGINT/SIGTERM and cancel context for graceful shutdown.
    sigs := make(chan os.Signal, 1)
    signal.Notify(sigs, os.Interrupt, syscall.SIGTERM)
    go func() {
        <-sigs
        log.Println("🛑 Shutdown signal received")
        cancel()
    }()

    // 4. Start device registry and REST API server.
    reg := registry.NewRegistry()
    go func() {
        mux := http.NewServeMux()

        // 4.1 Register built‐in /devices JSON API.
        api.RegisterRoutes(mux, reg)

        // 4.2 Enable HLS preview endpoint when feature‐flagged.
        if strings.EqualFold(os.Getenv("ENABLE_HLS_PREVIEW"), "true") {
            hlsDir := os.Getenv("HLS_PREVIEW_DIR")
            if hlsDir == "" {
                hlsDir = filepath.Join(os.TempDir(), "hls")
            }
            mux.Handle("/preview/", http.StripPrefix("/preview/", http.FileServer(http.Dir(hlsDir))))
            log.Printf("📺 HLS preview enabled at /preview/ (serving %s)", hlsDir)
        }

        // 4.3 Enable MP4 recordings endpoint when feature‐flagged.
        if strings.EqualFold(os.Getenv("ENABLE_MP4_SERVE"), "true") {
            recDir := os.Getenv("MP4_RECORDINGS_DIR")
            if recDir == "" {
                recDir = filepath.Join(os.TempDir(), "recordings")
            }
            mux.Handle("/recordings/", http.StripPrefix("/recordings/", http.FileServer(http.Dir(recDir))))
            log.Printf("📁 MP4 serving enabled at /recordings/ (from %s)", recDir)
        }

        log.Printf("🌐 REST API listening on :9000")
        if err := http.ListenAndServe(":9000", mux); err != nil {
            log.Fatalf("REST API failed: %v", err)
        }
    }()

    // 5. Main discovery + runner loop.
    pollInterval := 5 * time.Second
    for {
        select {
        case <-ctx.Done():
            log.Println("✅ Context cancelled, exiting main loop")
            reg.StopAll()
            return
        default:
        }

        // 5.1 Scan for devices and broadcast current list.
        devices, err := scanner.ScanAll()
        if err != nil {
            log.Printf("⚠️  Scanner error: %v", err)
        } else {
            reg.Update(devices)
            broker.Publish("capture.device_list", devices)
        }

        // 5.2 Launch FFmpeg runners for newly discovered devices.
        for id, dev := range reg.List() {
            if !reg.HasRunner(id) {
                cfg := runner.DefaultConfig(dev.Path)
                ctxLoop, cancelLoop := context.WithCancel(ctx)
                reg.RegisterStopFunc(id, cancelLoop)

                go func(deviceID string, c runner.Config) {
                    if err := runner.RunCaptureLoop(ctxLoop, c); err != nil {
                        log.Printf("🚨 Runner for %s exited with error: %v", deviceID, err)
                    }
                }(id, cfg)
            }
        }

        // 5.3 Wait before the next discovery iteration.
        time.Sleep(pollInterval)
    }
}