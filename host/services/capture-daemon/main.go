// /host/services/capture-daemon/main.go
package main

import (
    "log"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner"
    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/runner"
    "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/registry"
)

func main() {
    log.Println("ThatDamToolbox capture-daemon starting...")

    // Initialize registry (tracks device->worker)
    reg := registry.NewRegistry()

    // Set up signal handler for graceful shutdown
    sigs := make(chan os.Signal, 1)
    signal.Notify(sigs, os.Interrupt, syscall.SIGTERM)

    // Poll interval for device scanning
    pollInterval := 5 * time.Second

    // Main event loop
    go func() {
        for {
            // Scan for video devices (could combine multiple scanners)
            devices, err := scanner.ScanAll()  // You write ScanAll to combine V4L2, Pi, IPCam, etc.
            if err != nil {
                log.Printf("Device scan error: %v", err)
            } else {
                reg.Update(devices) // Registry: starts/stops runners as needed
            }
            time.Sleep(pollInterval)
        }
    }()

    // Block until shutdown
    <-sigs
    log.Println("Shutting down capture-daemon...")
    reg.StopAll()
}