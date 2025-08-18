package catalog

import (
	"encoding/json"
	"testing"
	"time"
)

type mem struct{ m map[string]Asset }

func newMem() *mem                                                           { return &mem{m: make(map[string]Asset)} }
func (m *mem) Upsert(a Asset) error                                          { m.m[a.ID] = a; return nil }
func (m *mem) GetByID(id string) (Asset, bool)                               { a, ok := m.m[id]; return a, ok }
func (m *mem) ListByFolder(folder string, page, pageSize int) ([]Asset, int) { return nil, 0 }
func (m *mem) ListFolders(prefix string) []string                            { return nil }
func (m *mem) Delete(id string) error                                        { delete(m.m, id); return nil }

func TestAssetJSON(t *testing.T) {
	a := Asset{ID: "1", Key: "k", CreatedAt: time.Unix(0, 0)}
	b, err := json.Marshal(a)
	if err != nil {
		t.Fatal(err)
	}
	var got Asset
	if err := json.Unmarshal(b, &got); err != nil {
		t.Fatal(err)
	}
	if got.ID != a.ID || got.Key != a.Key {
		t.Fatalf("roundtrip failed: %#v", got)
	}
}

func TestCatalogBasic(t *testing.T) {
	c := newMem()
	a := Asset{ID: "1"}
	if err := c.Upsert(a); err != nil {
		t.Fatal(err)
	}
	if _, ok := c.GetByID("1"); !ok {
		t.Fatalf("missing")
	}
	if err := c.Delete("1"); err != nil {
		t.Fatal(err)
	}
	if _, ok := c.GetByID("1"); ok {
		t.Fatalf("not deleted")
	}
}
