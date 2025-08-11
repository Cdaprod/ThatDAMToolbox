package v4l2

// Package v4l2 wraps the shared V4L2 probe for capture-daemon.
//
// Example:
//  res, err := v4l2.Discover()
//  if err != nil { log.Fatal(err) }
//  fmt.Println("kept", res.Kept)

import (
	"context"
	"os"
	"strings"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/hostcap/v4l2probe"
)

type Device = v4l2probe.Device

// Result bundles kept and dropped devices from discovery.
type Result struct {
	Kept    []Device
	Dropped []Device
}

// Discover runs the shared V4L2 probe with optional env overrides.
func Discover() (Result, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	opt := v4l2probe.DefaultOptions()
	if v := os.Getenv("V4L2_HARD_EXCLUDE"); v != "" {
		opt.HardExclude = splitCSVLower(v)
	}
	if v := os.Getenv("V4L2_ALLOW_M2M"); v != "" {
		opt.AllowM2M = splitCSVLower(v)
	}

	kept, dropped, err := v4l2probe.Discover(ctx, opt)
	return Result{Kept: kept, Dropped: dropped}, err
}

func splitCSVLower(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		p = strings.TrimSpace(strings.ToLower(p))
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}
