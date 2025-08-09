package main

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// TestHLSPreviewServesFile ensures the preview file server exposes playlists.
// Example: curl http://daemon/preview/cam1/index.m3u8
func TestHLSPreviewServesFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "index.m3u8")
	if err := os.WriteFile(path, []byte("#EXTM3U"), 0644); err != nil {
		t.Fatalf("write playlist: %v", err)
	}
	mux := http.NewServeMux()
	mux.Handle("/preview/", http.StripPrefix("/preview/", http.FileServer(http.Dir(dir))))
	srv := httptest.NewServer(mux)
	defer srv.Close()

	resp, err := http.Get(srv.URL + "/preview/index.m3u8")
	if err != nil {
		t.Fatalf("get preview: %v", err)
	}
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", resp.StatusCode)
	}
}
