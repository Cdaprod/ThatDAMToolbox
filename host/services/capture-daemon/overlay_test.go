package main

import (
	"context"
	"os"
	"testing"
)

func TestStartOverlayNoURL(t *testing.T) {
	os.Unsetenv("OVERLAY_HUB_URL")
	startOverlay(context.Background())
}
