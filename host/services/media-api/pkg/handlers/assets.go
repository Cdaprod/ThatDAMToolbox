package handlers

import (
	"encoding/json"
	"io"
	"net/http"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/storage"
	"github.com/Cdaprod/ThatDamToolbox/host/shared/tenant"
)

// Deps bundles dependencies for HTTP handlers.
type Deps struct {
	Cat catalog.Catalog
	BS  storage.BlobStore
	TD  tenant.TenantDirectoryPort
	MP  tenant.MembershipPort
	TR  tenant.TenantContextResolverPort
}

func (d Deps) json(w http.ResponseWriter, v any, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

// ListFolders handles GET /v1/folders.
func (d Deps) ListFolders(w http.ResponseWriter, r *http.Request) {
	if !d.withTenant(w, r) {
		return
	}
	prefix := r.URL.Query().Get("prefix")
	d.json(w, struct {
		Folders []string `json:"folders"`
	}{d.Cat.ListFolders(prefix)}, 200)
}

// ListAssets handles GET /v1/assets.
func (d Deps) ListAssets(w http.ResponseWriter, r *http.Request) {
	if !d.withTenant(w, r) {
		return
	}
	f := r.URL.Query().Get("folder")
	page := atoiDefault(r.URL.Query().Get("page"), 1)
	size := atoiDefault(r.URL.Query().Get("page_size"), 50)
	items, total := d.Cat.ListByFolder(f, page, size)
	d.json(w, struct {
		Total int             `json:"total"`
		Page  int             `json:"page"`
		Items []catalog.Asset `json:"items"`
	}{total, page, items}, 200)
}

// GetAsset handles GET /v1/assets/{id}.
func (d Deps) GetAsset(w http.ResponseWriter, r *http.Request) {
	if !d.withTenant(w, r) {
		return
	}
	id := r.PathValue("id")
	a, ok := d.Cat.GetByID(id)
	if !ok {
		http.Error(w, "not found", 404)
		return
	}
	d.json(w, a, 200)
}

// Bytes handles GET /v1/bytes?key=...
func (d Deps) Bytes(w http.ResponseWriter, r *http.Request) {
	if !d.withTenant(w, r) {
		return
	}
	key := r.URL.Query().Get("key")
	rc, err := d.BS.Get(key)
	if err != nil {
		http.Error(w, "missing", 404)
		return
	}
	defer rc.Close()
	w.Header().Set("Content-Type", "application/octet-stream")
	io.Copy(w, rc)
}

func atoiDefault(s string, d int) int {
	if s == "" {
		return d
	}
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return d
		}
		n = n*10 + int(c-'0')
	}
	if n <= 0 {
		return d
	}
	return n
}

func (d Deps) withTenant(w http.ResponseWriter, r *http.Request) bool {
	tenantID, principalID, err := d.TR.Resolve(r.Context(), r)
	if err != nil {
		http.Error(w, "tenant required", http.StatusUnauthorized)
		return false
	}
	if _, err := d.TD.GetTenant(r.Context(), tenantID); err != nil {
		http.Error(w, "tenant not found", http.StatusNotFound)
		return false
	}
	ok, err := d.MP.IsMember(r.Context(), tenantID, principalID)
	if err != nil || !ok {
		http.Error(w, "forbidden", http.StatusForbidden)
		return false
	}
	return true
}
