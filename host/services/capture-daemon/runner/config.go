// host/services/capture-daemon/runner/config.go
package runner

import (
	"os"
	"path/filepath"
)

// ResolveOutDir returns a writable directory for recordings.
// Priority: 1) CAPTURE_OUTDIR env var  2) $HOME/media/records  3) ./records
func ResolveOutDir() string {
	if v := os.Getenv("CAPTURE_OUTDIR"); v != "" {
		return v
	}
	if home, err := os.UserHomeDir(); err == nil {
		return filepath.Join(home, "media", "records")
	}
	return "./records"
}
