package config

// Package config provides environment-backed configuration for media-api.
// Example usage:
//
//  roots, err := config.GetScanRoots(platform.NewOSDirEnsurer())
//  if err != nil { log.Fatal(err) }
//
// It gathers local and network media paths to scan.

import (
	"bufio"
	"errors"
	"os"
	"path/filepath"
	"strings"

	"github.com/Cdaprod/ThatDamToolbox/host/shared/platform"
)

// GetScanRoots returns the blob store root plus any network paths.
// It reads the BLOB_STORE_ROOT env var, MEDIA_NETWORK_PATHS env var,
// and optional MEDIA_API_CFG file with a "network_paths" entry.
// Directories are created via the provided DirEnsurer.
func GetScanRoots(de platform.DirEnsurer) ([]string, error) {
	root := os.Getenv("BLOB_STORE_ROOT")
	if root == "" {
		root = "./data"
	}
	paths := []string{root}

	// from config file
	if cfg := os.Getenv("MEDIA_API_CFG"); cfg != "" {
		if extra, err := readNetworkPaths(cfg); err == nil {
			paths = append(paths, extra...)
		}
	}
	// from env
	if env := os.Getenv("MEDIA_NETWORK_PATHS"); env != "" {
		for _, p := range strings.Split(env, ",") {
			p = strings.TrimSpace(p)
			if p != "" {
				paths = append(paths, p)
			}
		}
	}

	// dedupe and ensure dirs
	seen := map[string]struct{}{}
	out := make([]string, 0, len(paths))
	specs := []platform.FileSpec{}
	for _, p := range paths {
		if p == "" {
			continue
		}
		abs, err := filepath.Abs(p)
		if err != nil {
			return nil, err
		}
		if _, ok := seen[abs]; ok {
			continue
		}
		seen[abs] = struct{}{}
		specs = append(specs, platform.FileSpec{Path: abs, Mode: 0o755})
		out = append(out, abs)
	}
	if err := de.EnsureDirs(specs); err != nil {
		return nil, err
	}
	return out, nil
}

// readNetworkPaths parses a simple key=value config file for network_paths.
func readNetworkPaths(path string) ([]string, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	var out []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if strings.HasPrefix(line, "#") || line == "" {
			continue
		}
		if strings.Contains(line, "=") {
			parts := strings.SplitN(line, "=", 2)
			key := strings.TrimSpace(parts[0])
			val := strings.TrimSpace(parts[1])
			if key == "network_paths" {
				for _, p := range strings.Split(val, ",") {
					p = strings.TrimSpace(p)
					if p != "" {
						out = append(out, p)
					}
				}
			}
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, errors.New("no network_paths")
	}
	return out, nil
}
