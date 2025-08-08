package main

import (
	"context"
	"os"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/overlay"
)

func startOverlay(ctx context.Context) {
	hub := os.Getenv("OVERLAY_HUB_URL")
	if hub == "" {
		return
	}
	c := overlay.NewClient(hub)
	if err := c.Register(ctx, "capture-daemon"); err != nil {
		return
	}
	go c.Heartbeat(ctx, 30*time.Second)
}
