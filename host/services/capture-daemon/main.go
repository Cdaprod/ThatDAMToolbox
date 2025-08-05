// host/services/capture-daemon/main.go
package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/api"
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/broker"
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