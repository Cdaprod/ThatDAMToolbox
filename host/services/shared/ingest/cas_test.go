package ingest

import (
	"bytes"
	"io"
	"os"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/storage"
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

// simpleBlobStore wraps storage.NewFS rooted at tmp.
func newBS(t *testing.T) storage.BlobStore {
	t.Helper()
	dir := t.TempDir()
	return storage.NewFS(dir, testDirEnsurer{})
}

func TestPutIfAbsent(t *testing.T) {
	bs := newBS(t)
	key1, hash1, existed1, err := PutIfAbsent(bs, bytes.NewReader([]byte("hello")))
	if err != nil || existed1 {
		t.Fatalf("first put: %v existed=%v", err, existed1)
	}
	key2, hash2, existed2, err := PutIfAbsent(bs, bytes.NewReader([]byte("hello")))
	if err != nil || !existed2 || key1 != key2 || hash1 != hash2 {
		t.Fatalf("second put failed: %v %v %v %v", err, existed2, key1, key2)
	}
	// ensure blob exists
	r, err := bs.Get(key1)
	if err != nil {
		t.Fatalf("blob missing: %v", err)
	}
	b, _ := io.ReadAll(r)
	if string(b) != "hello" {
		t.Fatalf("unexpected data: %s", b)
	}
}

func TestWriteIndex(t *testing.T) {
	bs := newBS(t)
	key, err := WriteIndex(bs, "abcd", 1.23)
	if err != nil {
		t.Fatalf("WriteIndex: %v", err)
	}
	r, err := bs.Get(key)
	if err != nil {
		t.Fatalf("index missing: %v", err)
	}
	data, _ := io.ReadAll(r)
	if string(data) != "{\"duration\":1.23}" {
		t.Fatalf("unexpected index: %s", data)
	}
}
