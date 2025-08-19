package storage

import (
	"bytes"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/shared/platform"
)

type testDirEnsurer struct{}

func (testDirEnsurer) EnsureDirs(specs []platform.FileSpec) error {
	for _, s := range specs {
		if err := os.MkdirAll(s.Path, 0o755); err != nil {
			return err
		}
	}
	return nil
}

// TestFS exercises basic BlobStore operations.
func TestFS(t *testing.T) {
	dir := t.TempDir()
	bs := NewFS(dir, testDirEnsurer{})
	key := "a/b.txt"
	if err := bs.Put(key, bytes.NewBufferString("hi")); err != nil {
		t.Fatal(err)
	}
	ok, err := bs.Exists(key)
	if err != nil || !ok {
		t.Fatalf("Exists: %v %v", ok, err)
	}
	var keys []string
	if err := bs.List("a", func(k string) bool { keys = append(keys, k); return true }); err != nil {
		t.Fatal(err)
	}
	if len(keys) != 1 || keys[0] != key {
		t.Fatalf("List got %v", keys)
	}
	r, err := bs.Get(key)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(r)
	r.Close()
	if string(b) != "hi" {
		t.Fatalf("Get %s", b)
	}
	if err := bs.Delete(key); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(dir, key)); !os.IsNotExist(err) {
		t.Fatalf("delete failed: %v", err)
	}
}
