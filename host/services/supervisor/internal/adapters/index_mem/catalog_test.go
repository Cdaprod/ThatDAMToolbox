package indexmem

import (
	"testing"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
)

func TestMemCatalog(t *testing.T) {
	m := NewCatalog()
	a1 := catalog.Asset{ID: "1", Folder: "f", CreatedAt: time.Unix(0, 0)}
	a2 := catalog.Asset{ID: "2", Folder: "f", CreatedAt: time.Unix(1, 0)}
	if err := m.Upsert(a1); err != nil {
		t.Fatal(err)
	}
	if err := m.Upsert(a2); err != nil {
		t.Fatal(err)
	}
	items, total := m.ListByFolder("f", 1, 10)
	if total != 2 || len(items) != 2 || items[0].ID != "1" {
		t.Fatalf("bad list %v %d", items, total)
	}
	if _, ok := m.GetByID("1"); !ok {
		t.Fatalf("missing")
	}
	if err := m.Delete("1"); err != nil {
		t.Fatal(err)
	}
	if _, ok := m.GetByID("1"); ok {
		t.Fatalf("still present")
	}
	folders := m.ListFolders("")
	if len(folders) != 1 || folders[0] != "f" {
		t.Fatalf("folders %v", folders)
	}
}
