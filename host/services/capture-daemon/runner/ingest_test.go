package runner

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/storage"
)

func TestIngestRecording(t *testing.T) {
	bs := storage.NewFS(t.TempDir())
	tmp := filepath.Join(t.TempDir(), "a.mp4")
	os.WriteFile(tmp, []byte("hello"), 0o644)
	deps := Deps{BlobStore: bs}
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
