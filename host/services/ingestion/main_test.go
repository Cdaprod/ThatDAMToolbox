package main

import (
	"crypto/sha256"
	"encoding/hex"
	"os"
	"path/filepath"
	"testing"
)

func TestBuildManifest(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "sample.txt")
	content := []byte("hello world")
	if err := os.WriteFile(path, content, 0644); err != nil {
		t.Fatalf("write file: %v", err)
	}

	m, err := buildManifest(path, 4)
	if err != nil {
		t.Fatalf("buildManifest error: %v", err)
	}
	if m.Size != int64(len(content)) {
		t.Fatalf("size mismatch: got %d", m.Size)
	}
	if len(m.Chunks) != 3 {
		t.Fatalf("expected 3 chunks, got %d", len(m.Chunks))
	}
	// verify first chunk hash
	sum0 := sha256.Sum256(content[:4])
	if m.Chunks[0].Hash != hex.EncodeToString(sum0[:]) {
		t.Fatalf("chunk0 hash mismatch")
	}
}
