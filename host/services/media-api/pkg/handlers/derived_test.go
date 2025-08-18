package handlers

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/ingest"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/storage"
)

type memCatalog struct{ last catalog.Asset }

func (m *memCatalog) Upsert(a catalog.Asset) error         { m.last = a; return nil }
func (m *memCatalog) GetByID(string) (catalog.Asset, bool) { return catalog.Asset{}, false }
func (m *memCatalog) ListByFolder(string, int, int) ([]catalog.Asset, int) {
	return nil, 0
}
func (m *memCatalog) ListFolders(string) []string { return nil }
func (m *memCatalog) Delete(string) error         { return nil }

func TestPreviewWorker(t *testing.T) {
	bs := storage.NewFS(t.TempDir())
	key, hash, _, err := ingest.PutIfAbsent(bs, bytes.NewReader([]byte("hello")))
	if err != nil {
		t.Fatal(err)
	}
	a := catalog.Asset{ID: "1", Key: key, Hash: hash}
	payload, _ := json.Marshal(a)
	cat := &memCatalog{}
	handleAsset(bs, cat, payload)
	dkey := ingest.DerivedKey(a.Hash, "poster.jpg", "")
	if ok, _ := bs.Exists(dkey); !ok {
		t.Fatalf("derived missing")
	}
	if cat.last.ID != a.ID {
		t.Fatalf("catalog not updated")
	}
	// second handle should be idempotent
	handleAsset(bs, cat, payload)
}
