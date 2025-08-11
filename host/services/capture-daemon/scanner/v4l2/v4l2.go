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

        keptCh, dropCh, errCh := v4l2probe.DiscoverStream(ctx, opt)

        var (
                kept    []Device
                dropped []Device
                retErr  error
        )

        for keptCh != nil || dropCh != nil || errCh != nil {
                select {
                case d, ok := <-keptCh:
                        if !ok {
                                keptCh = nil
                                continue
                        }
                        kept = append(kept, d)
                case d, ok := <-dropCh:
                        if !ok {
                                dropCh = nil
                                continue
                        }
                        dropped = append(dropped, d)
                case err, ok := <-errCh:
                        if ok && err != nil {
                                retErr = err
                        }
                        errCh = nil
                }
        }

        return Result{Kept: kept, Dropped: dropped}, retErr
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
