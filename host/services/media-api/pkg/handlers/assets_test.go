package handlers

import (
	"bytes"
	"io"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
)

type memCat struct{ m map[string]catalog.Asset }

func newMemCat() *memCat                                  { return &memCat{m: make(map[string]catalog.Asset)} }
func (m *memCat) Upsert(a catalog.Asset) error            { m.m[a.ID] = a; return nil }
func (m *memCat) GetByID(id string) (catalog.Asset, bool) { a, ok := m.m[id]; return a, ok }
func (m *memCat) ListByFolder(f string, p, s int) ([]catalog.Asset, int) {
	var out []catalog.Asset
	for _, a := range m.m {
		if a.Folder == f {
			out = append(out, a)
		}
	}
	return out, len(out)
}
func (m *memCat) ListFolders(prefix string) []string { return []string{"f"} }
func (m *memCat) Delete(id string) error             { delete(m.m, id); return nil }

type nopStore struct{}

func (nopStore) Put(string, io.Reader) error { return nil }
func (nopStore) Get(key string) (io.ReadCloser, error) {
	return io.NopCloser(bytes.NewBufferString("x")), nil
}
func (nopStore) Delete(string) error                  { return nil }
func (nopStore) Exists(string) (bool, error)          { return true, nil }
func (nopStore) List(string, func(string) bool) error { return nil }

func TestListAssets(t *testing.T) {
	c := newMemCat()
	c.Upsert(catalog.Asset{ID: "1", Folder: "f", CreatedAt: time.Unix(0, 0)})
	h := Deps{Cat: c, BS: nopStore{}}
	req := httptest.NewRequest("GET", "/v1/assets?folder=f", nil)
	w := httptest.NewRecorder()
	h.ListAssets(w, req)
	if w.Code != 200 {
		t.Fatalf("code %d", w.Code)
	}
}
