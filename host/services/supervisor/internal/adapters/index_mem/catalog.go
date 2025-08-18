package indexmem

import (
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
)

// Mem provides an in-memory catalog for assets.
type Mem struct {
	mu       sync.RWMutex
	byID     map[string]catalog.Asset
	byFolder map[string][]string
}

// NewCatalog constructs an empty Mem.
func NewCatalog() *Mem {
	return &Mem{byID: make(map[string]catalog.Asset), byFolder: make(map[string][]string)}
}

func (m *Mem) Upsert(a catalog.Asset) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if old, ok := m.byID[a.ID]; ok && old.Folder != a.Folder {
		ids := m.byFolder[old.Folder]
		for i, id := range ids {
			if id == old.ID {
				m.byFolder[old.Folder] = append(ids[:i], ids[i+1:]...)
				break
			}
		}
	}
	m.byID[a.ID] = a
	list := m.byFolder[a.Folder]
	found := false
	for _, id := range list {
		if id == a.ID {
			found = true
			break
		}
	}
	if !found {
		list = append(list, a.ID)
	}
	sort.SliceStable(list, func(i, j int) bool {
		ai, aj := m.byID[list[i]], m.byID[list[j]]
		if !ai.CreatedAt.Equal(aj.CreatedAt) {
			return ai.CreatedAt.Before(aj.CreatedAt)
		}
		return list[i] < list[j]
	})
	m.byFolder[a.Folder] = list
	return nil
}

func (m *Mem) GetByID(id string) (catalog.Asset, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	a, ok := m.byID[id]
	return a, ok
}

func (m *Mem) ListByFolder(folder string, page, pageSize int) ([]catalog.Asset, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 50
	}
	m.mu.RLock()
	defer m.mu.RUnlock()
	ids := m.byFolder[folder]
	total := len(ids)
	start := (page - 1) * pageSize
	if start >= total {
		return nil, total
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	out := make([]catalog.Asset, 0, end-start)
	for _, id := range ids[start:end] {
		out = append(out, m.byID[id])
	}
	return out, total
}

func (m *Mem) ListFolders(prefix string) []string {
	m.mu.RLock()
	defer m.mu.RUnlock()
	var out []string
	for f := range m.byFolder {
		if prefix == "" || strings.HasPrefix(f, prefix) {
			out = append(out, f)
		}
	}
	sort.Strings(out)
	return out
}

func (m *Mem) Delete(id string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	a, ok := m.byID[id]
	if !ok {
		return nil
	}
	delete(m.byID, id)
	ids := m.byFolder[a.Folder]
	for i, v := range ids {
		if v == id {
			m.byFolder[a.Folder] = append(ids[:i], ids[i+1:]...)
			break
		}
	}
	return nil
}

// ensure Mem implements catalog.Catalog
var _ catalog.Catalog = (*Mem)(nil)

// zero time to avoid unused import
var _ = time.Time{}
