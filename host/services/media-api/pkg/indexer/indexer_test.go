package indexer

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
)

type memCat struct{ m map[string]catalog.Asset }

func newMemCat() *memCat { return &memCat{m: make(map[string]catalog.Asset)} }

func (m *memCat) Upsert(a catalog.Asset) error                         { m.m[a.ID] = a; return nil }
func (m *memCat) GetByID(id string) (catalog.Asset, bool)              { a, ok := m.m[id]; return a, ok }
func (m *memCat) ListByFolder(string, int, int) ([]catalog.Asset, int) { return nil, 0 }
func (m *memCat) ListFolders(string) []string                          { return nil }
func (m *memCat) Delete(string) error                                  { return nil }

func TestScan(t *testing.T) {
	cat := newMemCat()
	tmp := t.TempDir()
	os.WriteFile(filepath.Join(tmp, "a.txt"), []byte("hello"), 0o644)
	if err := Scan(context.Background(), []string{tmp}, cat); err != nil {
		t.Fatalf("Scan: %v", err)
	}
	if len(cat.m) != 1 {
		t.Fatalf("expected 1 asset, got %d", len(cat.m))
	}
	if err := Scan(context.Background(), []string{tmp}, cat); err != nil {
		t.Fatalf("second Scan: %v", err)
	}
	if len(cat.m) != 1 {
		t.Fatalf("expected idempotent scan, got %d", len(cat.m))
	}
}
