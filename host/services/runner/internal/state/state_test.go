package state

import (
	"os"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/shared/platform"
)

type nopDirEnsurer struct{}

func (nopDirEnsurer) EnsureDirs([]platform.FileSpec) error { return nil }

func TestStoreRoundTrip(t *testing.T) {
	dir := t.TempDir()
	st := NewDiskStore(dir, nopDirEnsurer{})
	if err := st.SaveGeneration("node1", "abc"); err != nil {
		t.Fatalf("save: %v", err)
	}
	got, err := st.LoadGeneration("node1")
	if err != nil {
		t.Fatalf("load: %v", err)
	}
	if got != "abc" {
		t.Fatalf("want abc got %s", got)
	}
}

func TestSanitize(t *testing.T) {
	if sanitize("a b/c") != "a_b_c" {
		t.Fatal("sanitize failed")
	}
	if sanitize("") != "node" {
		t.Fatal("empty fallback")
	}
}

// ensure files created
func TestStoreCreatesDir(t *testing.T) {
	dir := t.TempDir()
	path := dir + "/sub"
	st := NewDiskStore(path, platform.NewOSDirEnsurer())
	if _, err := os.Stat(path); err != nil {
		t.Fatalf("dir not created: %v", err)
	}
	_ = st.SaveGeneration("n", "1")
}
