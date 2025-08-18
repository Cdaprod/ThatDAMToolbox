package handlers

import (
	"bytes"
	"encoding/json"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/ingest"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/storage"
)

func TestPreviewWorker(t *testing.T) {
	bs := storage.NewFS(t.TempDir())
	key, hash, _, err := ingest.PutIfAbsent(bs, bytes.NewReader([]byte("hello")))
	if err != nil {
		t.Fatal(err)
	}
	a := catalog.Asset{ID: "1", Key: key, Hash: hash}
	payload, _ := json.Marshal(a)
	handleAsset(bs, payload)
	dkey := ingest.DerivedKey(a.Hash, "poster.jpg", "")
	if ok, _ := bs.Exists(dkey); !ok {
		t.Fatalf("derived missing")
	}
	// second handle should be idempotent
	handleAsset(bs, payload)
}
