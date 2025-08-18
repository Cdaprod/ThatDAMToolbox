package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
)

// UpsertAsset handles POST /v1/catalog/upsert.
func (d Deps) UpsertAsset(w http.ResponseWriter, r *http.Request) {
	var a catalog.Asset
	if err := json.NewDecoder(r.Body).Decode(&a); err != nil {
		http.Error(w, "bad json", 400)
		return
	}
	if err := d.Cat.Upsert(a); err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	d.json(w, struct {
		OK bool `json:"ok"`
	}{true}, 200)
}
