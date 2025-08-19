// Command ensure-dirs prepares filesystem paths before services start.
//
// Usage:
//
//	go run ./host/core/platform/cmd/ensure-dirs --uid 1000 --gid 16000 --mode 0o2775 /var/lib/thatdamtoolbox/db /var/lib/thatdamtoolbox/media
//
// Flags apply to all provided paths. Exits with code 1 on failure.
package main

import (
	"flag"
	"log"
	"os"

	"github.com/Cdaprod/ThatDamToolbox/host/core/platform"
)

func main() {
	uid := flag.Int("uid", os.Getuid(), "UID for ownership")
	gid := flag.Int("gid", os.Getgid(), "GID for ownership")
	mode := flag.Uint("mode", 0o2775, "octal directory mode")
	flag.Parse()
	if flag.NArg() == 0 {
		flag.Usage()
		os.Exit(1)
	}
	specs := make([]platform.FileSpec, 0, flag.NArg())
	for _, p := range flag.Args() {
		specs = append(specs, platform.FileSpec{Path: p, UID: *uid, GID: *gid, Mode: os.FileMode(*mode)})
	}
	if err := platform.EnsureDirs(specs); err != nil {
		log.Fatalf("ensure dirs: %v", err)
	}
}
