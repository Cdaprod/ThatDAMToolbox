package main

import (
	"os"
	"time"

	"github.com/Cdaprod/ThatDAMToolbox/host/services/discovery/internal/manager"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/logx"
)

// main is the discovery service entrypoint.
// Example: go run ./host/services/discovery
func main() {
	logx.Init(logx.Config{
		Service: "discovery",
		Version: manager.Version,
		Level:   getEnv("LOG_LEVEL", "info"),
		Format:  getEnv("LOG_FORMAT", "auto"),
		Caller:  getEnv("LOG_CALLER", "short"),
		Time:    getEnv("LOG_TIME", "rfc3339ms"),
		NoColor: os.Getenv("LOG_NO_COLOR") == "1",
	})

	dm := manager.New()

	go func() {
		time.Sleep(time.Hour)
		dm.Stop()
	}()

	if err := dm.Start(); err != nil {
		logx.L.Error("failed to start discovery service", "err", err)
		os.Exit(1)
	}

	select {}
}

func getEnv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
