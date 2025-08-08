package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
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
	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/webrtc"
)

const (
	version         = "1.0.0"
	shutdownTimeout = 10 * time.Second
)

func main() {
	// 1. Load config (from env/file)
	cfg, err := config.Load()
	if err != nil {
		panic(fmt.Sprintf("config load failed: %v", err))
	}

	// 2. Init logger
	lg, err := logger.New(cfg.Logging.Level, cfg.Logging.Format, cfg.Logging.Output)
	if err != nil {
		panic(fmt.Sprintf("logger init failed: %v", err))
	}
	lg.Info("🔌 starting capture-daemon", "version", version)

	// 3. Init broker
	broker.Init()
	broker.Publish("capture.service_up", map[string]any{"ts": time.Now().Unix(), "version": version})
	broker.PublishSchemas()

	// 3a. Init WebRTC if enabled
	if cfg.Features.WebRTC.Enabled {
		if err := webrtc.InitAPI(); err != nil {
			lg.WithComponent("webrtc").Error("init failed", "err", err)
		} else {
			lg.WithComponent("webrtc").Info("WebRTC enabled", "prefix", cfg.Features.WebRTC.PathPrefix)
		}
	}

	// 4. Init metrics & health
	m := metrics.New()
	hc := health.New(cfg.Health.Interval)
	hc.AddCheck("broker", func(ctx context.Context) (health.Status, string, error) {
		if broker.IsConnected() {
			return health.StatusHealthy, "ok", nil
		}
		return health.StatusUnhealthy, "disconnected", nil
	})

	// 5. Context & shutdown manager
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	sd := shutdown.NewManager(lg.Logger, shutdownTimeout)
	startOverlay(ctx)

	// 6. Metrics server
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

	// 7. Health server
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

	// 8. Main API server (devices, recordings, previews, etc.)
	reg := registry.NewRegistry()
	mux := http.NewServeMux()
	api.RegisterRoutes(mux, reg)
	api.RegisterFeatureRoutes(mux, cfg)
	if cfg.Features.WebRTC.Enabled {
		webrtc.RegisterRoutes(mux, cfg.Features.WebRTC.PathPrefix)
	}

	// Serve HLS previews if enabled
	if cfg.Features.HLSPreview.Enabled {
		h := cfg.Features.HLSPreview.Dir
		if h == "" {
			h = filepath.Join(os.TempDir(), "hls")
		}
		mux.Handle("/preview/", http.StripPrefix("/preview/", http.FileServer(http.Dir(h))))
		lg.Info("📺 HLS preview enabled", "dir", h)
	}

	// Serve MP4 recordings if enabled
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

	// 9. Device discovery and capture runner loop
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
						if cfg.Features.WebRTC.Enabled {
							go func(device string, fps int, res string) {
								_ = webrtc.StreamH264FromFFmpeg(ctxLoop, device, fps, res)
							}(d.Path, c.FPS, c.Resolution)
						}
					}
				}
			}
		}
	})

	// Ensure broker drains on shutdown
	sd.AddHook("broker-close", func(ctx context.Context) error {
		broker.Close()
		return nil
	})

	// Wait for signal or context cancel
	sd.Wait(ctx)
	lg.Info("✅ capture-daemon stopped")
}
