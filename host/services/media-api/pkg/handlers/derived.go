package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/color"
	"image/jpeg"
	"io"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/bus"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/ingest"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/storage"
)

// StartPreviewWorker subscribes to asset.ingested and writes a tiny poster.jpg.
// Example:
//
//	bs := storage.NewFS("/tmp/blobs")
//	ctx, cancel := context.WithCancel(context.Background())
//	defer cancel()
//	StartPreviewWorker(ctx, bs)
func StartPreviewWorker(ctx context.Context, bs storage.BlobStore) error {
	return bus.Subscribe("asset.ingested", func(b []byte) { handleAsset(bs, b) })
}

// handleAsset generates a placeholder preview for one asset message.
func handleAsset(bs storage.BlobStore, b []byte) {
	var a catalog.Asset
	if err := json.Unmarshal(b, &a); err != nil {
		return
	}
	key := ingest.DerivedKey(a.Hash, "poster.jpg", "")
	if ok, _ := bs.Exists(key); ok {
		return
	}
	img := image.NewRGBA(image.Rect(0, 0, 1, 1))
	img.Set(0, 0, color.White)
	var buf bytes.Buffer
	_ = jpeg.Encode(&buf, img, nil)
	_ = bs.Put(key, io.NopCloser(bytes.NewReader(buf.Bytes())))
	_ = bus.Publish("asset.derived", map[string]string{"src": a.ID, "key": key, "kind": "poster"})
}
