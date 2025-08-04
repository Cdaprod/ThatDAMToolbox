// /host/services/capture-daemon/main.go
package main

import (
    "context"
    "log"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/registry"
    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/runner"
    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner"
    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/broker"
    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/api"
    // import any scanner implementations so their init() calls Register()
    _ "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner/v4l2"
)

func main() {
    log.Println("🔌 ThatDamToolbox capture-daemon starting…")
    // ① connect to RabbitMQ
    broker.Init()
    broker.Publish("capture.service_up", map[string]any{"ts": time.Now().Unix()})
    broker.PublishSchemas()
    
    // Create a cancellable root context
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()

    // Hook into SIGINT/SIGTERM for graceful shutdown
    sigs := make(chan os.Signal, 1)
    signal.Notify(sigs, os.Interrupt, syscall.SIGTERM)
    go func() {
        <-sigs
        log.Println("🛑 Shutdown signal received")
        cancel()
    }()

    // Create registry and start its HTTP API (optional)
    reg := registry.NewRegistry()
    // --- API mux: serve REST endpoints (devices, etc) ---
    go func() {
        mux := http.NewServeMux()
        api.RegisterRoutes(mux, reg) // ← new
        log.Printf("🌐 REST API listening on :9000")
        if err := http.ListenAndServe(":9000", mux); err != nil {
            log.Fatalf("REST API failed: %v", err)
        }
    }()

    // Main polling + runner loop
    pollInterval := 5 * time.Second
    for {
        select {
        case <-ctx.Done():
            log.Println("✅ Context cancelled, exiting main loop")
            reg.StopAll()
            return
        default:
        }

        // Discover devices
        devices, err := scanner.ScanAll()
        if err != nil {
            log.Printf("⚠️  Scanner error: %v", err)
        } else {
            // This will start new runners and stop ones for removed devices
            reg.Update(devices)
            // ② broadcast latest device table every poll
            broker.Publish("capture.device_list", devices)

        }

        // Launch/stop runners based on registry state
        for id, dev := range reg.List() {
            // If no runner yet, start one
            if !reg.HasRunner(id) {
                cfg := runner.DefaultConfig(dev.Path)
                // customize cfg if needed: cfg.FPS, cfg.OutDir, etc.
                ctxLoop, cancelLoop := context.WithCancel(ctx)
                reg.RegisterStopFunc(id, cancelLoop)

                go func(deviceID string, c runner.Config) {
                    if err := runner.RunCaptureLoop(ctxLoop, c); err != nil {
                        log.Printf("🚨 Runner for %s exited with error: %v", deviceID, err)
                    }
                }(id, cfg)
            }
        }

        time.Sleep(pollInterval)
    }
}