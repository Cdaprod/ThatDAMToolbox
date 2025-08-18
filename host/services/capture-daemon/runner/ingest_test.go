package runner

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/storage"
)

type memCatalog struct{ last catalog.Asset }

func (m *memCatalog) Upsert(a catalog.Asset) error            { m.last = a; return nil }
func (m *memCatalog) GetByID(id string) (catalog.Asset, bool) { return catalog.Asset{}, false }
func (m *memCatalog) ListByFolder(folder string, page, pageSize int) ([]catalog.Asset, int) {
	return nil, 0
}
func (m *memCatalog) ListFolders(prefix string) []string { return nil }
func (m *memCatalog) Delete(id string) error             { return nil }

func TestIngestRecording(t *testing.T) {
	bs := storage.NewFS(t.TempDir())
	tmp := filepath.Join(t.TempDir(), "a.mp4")
	os.WriteFile(tmp, []byte("hello"), 0o644)
	cat := &memCatalog{}
	deps := Deps{BlobStore: bs, Catalog: cat}
	asset, err := ingestRecording(deps, tmp)
	if err != nil {
		t.Fatal(err)
	}
	if asset.Hash == "" {
		t.Fatalf("asset not stored")
	}
	// Ensure index exists
	if ok, _ := bs.Exists(asset.Labels["index_key"]); !ok {
		t.Fatalf("index missing")
	}
}
