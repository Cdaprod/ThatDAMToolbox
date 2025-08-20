package config

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/shared/platform"
)

// testDirEnsurer ensures directories by storing the last requested paths.
type testDirEnsurer struct{ paths []string }

func (t *testDirEnsurer) EnsureDirs(specs []platform.FileSpec) error {
	for _, s := range specs {
		t.paths = append(t.paths, s.Path)
	}
	return nil
}

func TestGetScanRoots(t *testing.T) {
	de := &testDirEnsurer{}
	tmp := t.TempDir()
	cfgPath := filepath.Join(tmp, "cfg.ini")
	os.WriteFile(cfgPath, []byte("network_paths=/n1,/n2"), 0o644)
	os.Setenv("BLOB_STORE_ROOT", filepath.Join(tmp, "data"))
	os.Setenv("MEDIA_API_CFG", cfgPath)
	os.Setenv("MEDIA_NETWORK_PATHS", "/env1")
	roots, err := GetScanRoots(de)
	if err != nil {
		t.Fatalf("GetScanRoots: %v", err)
	}
	if len(roots) != 4 {
		t.Fatalf("expected 4 roots, got %d", len(roots))
	}
	if de.paths[0] != roots[0] {
		t.Fatalf("expected EnsureDirs called with root %s", roots[0])
	}
}
