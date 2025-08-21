package runner

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/ptp"
	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/storage"
	"github.com/Cdaprod/ThatDamToolbox/host/shared/platform"
)

type testDirEnsurer struct{}

func (testDirEnsurer) EnsureDirs(specs []platform.FileSpec) error {
	for _, s := range specs {
		if err := os.MkdirAll(s.Path, 0o755); err != nil {
			return err
		}
	}
	return nil
}

func TestIngestRecording(t *testing.T) {
	bs := storage.NewFS(t.TempDir(), testDirEnsurer{})
	tmp := filepath.Join(t.TempDir(), "a.mp4")
	os.WriteFile(tmp, []byte("hello"), 0o644)
	deps := Deps{BlobStore: bs, Clock: ptp.New()}
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
