// host/services/capture-daemon/main.go
package main

import (
	"context"
<<<<<<< ours
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
=======
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
>>>>>>> theirs
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/api"
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/broker"
<<<<<<< ours
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/config"
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/pkg/health"
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/pkg/logger"
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/pkg/metrics"
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/pkg/server"
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/pkg/shutdown"
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/registry"
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/runner"
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner"
	_ "github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner/v4l2"
)

const (
	version         = "1.0.0"
	shutdownTimeout = 10 * time.Second
)

func main() {
	// ① Load config
	cfg, err := config.Load()
	if err != nil {
		panic(fmt.Sprintf("config load failed: %v", err))
	}

	// ② Init logger
	lg, err := logger.New(cfg.Logging.Level, cfg.Logging.Format, cfg.Logging.Output)
	if err != nil {
		panic(fmt.Sprintf("logger init failed: %v", err))
	}
	lg.Info("🔌 starting capture-daemon", "version", version)

	// ③ Init broker
	broker.Init()
	broker.Publish("capture.service_up", map[string]any{"ts": time.Now().Unix(), "version": version})
	broker.PublishSchemas()

	// ④ Init metrics & health
	m := metrics.New()
	hc := health.New(cfg.Health.Interval)
	hc.AddCheck("broker", func(ctx context.Context) (health.Status, string, error) {
		if broker.IsConnected() {
			return health.StatusHealthy, "ok", nil
		}
		return health.StatusUnhealthy, "disconnected", nil
	})

	// ⑤ Context & shutdown manager
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sd := shutdown.NewManager(lg.Logger, shutdownTimeout)

	// ⑥ Metrics server
	if cfg.Features.Metrics.Enabled {
		ms := server.New(
			fmt.Sprintf(":%d", cfg.Features.Metrics.Port),
			m.Handler(),
			lg.Logger,
			map[string]time.Duration{},
		)
		go ms.Start()
		sd.AddHook("metrics-server", ms.Shutdown)
	}

	// ⑦ Health server
	if cfg.Health.Enabled {
		hs := server.New(
			fmt.Sprintf(":%d", cfg.Health.Port),
			hc.Handler(),
			lg.Logger,
			map[string]time.Duration{},
		)
		go hs.Start()
		sd.AddHook("health-server", hs.Shutdown)
	}

	// ⑧ Main API server
	reg := registry.NewRegistry()
	mux := http.NewServeMux()
	api.RegisterRoutes(mux, reg)

	if cfg.Features.HLSPreview.Enabled {
		h := cfg.Features.HLSPreview.Dir
		if h == "" {
			h = filepath.Join(os.TempDir(), "hls")
		}
		mux.Handle("/preview/", http.StripPrefix("/preview/", http.FileServer(http.Dir(h))))
		lg.Info("📺 HLS preview enabled", "dir", h)
	}

	if cfg.Features.MP4Serve.Enabled {
		r := cfg.Features.MP4Serve.Dir
		if r == "" {
			r = filepath.Join(os.TempDir(), "recordings")
		}
		mux.Handle("/recordings/", http.StripPrefix("/recordings/", http.FileServer(http.Dir(r))))
		lg.Info("📁 MP4 serving enabled", "dir", r)
	}

	mainSrv := server.New(
		fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port),
		mux,
		lg.Logger,
		map[string]time.Duration{
			"read":  cfg.Server.ReadTimeout,
			"write": cfg.Server.WriteTimeout,
			"idle":  cfg.Server.IdleTimeout,
		},
	)
	go mainSrv.Start()
	sd.AddHook("main-server", mainSrv.Shutdown)

	// ⑨ Discovery & capture loop
	sd.AddHook("capture-loop", func(ctx context.Context) error {
		t := time.NewTicker(cfg.Capture.PollInterval)
		defer t.Stop()
		for {
			select {
			case <-ctx.Done():
				reg.StopAll()
				return nil
			case <-t.C:
				devs, _ := scanner.ScanAll()
				reg.Update(devs)
				broker.Publish("capture.device_list", devs)
				for id, d := range reg.List() {
					if !reg.HasRunner(id) {
						c := runner.DefaultConfig(d.Path)
						c.FPS = cfg.Capture.DefaultFPS
						c.Resolution = cfg.Capture.DefaultRes
						ctxLoop, cl := context.WithCancel(ctx)
						reg.RegisterStopFunc(id, cl)
						go func(id string, cfg runner.Config) {
							if err := runner.RunCaptureLoop(ctxLoop, cfg); err != nil {
								lg.WithComponent("runner").Error("runner error", "device", id, "err", err)
							}
						}(id, c)
					}
				}
			}
		}
	})
	
	// 🛑 Ensure we drain the broker on shutdown
    sd.AddHook("broker-close", func(ctx context.Context) error {
        broker.Close()
        return nil
    })

	// 🔚 Wait for shutdown
	sd.Wait(ctx)
	lg.Info("✅ capture-daemon stopped")
}
=======
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/registry"
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/runner"
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/scanner"
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
>>>>>>> theirs
