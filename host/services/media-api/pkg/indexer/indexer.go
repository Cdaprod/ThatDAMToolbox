package indexer

// Package indexer walks media directories and populates the catalog.
// Example:
//
//  err := indexer.Scan(context.Background(), roots, cat)
//
// Repeated scans skip unchanged files.

import (
	"context"
	"crypto/sha1"
	"fmt"
	"io"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/catalog"
)

// Scan iterates over roots and upserts discovered assets into the catalog.
func Scan(ctx context.Context, roots []string, cat catalog.Catalog) error {
	for _, root := range roots {
		err := filepath.WalkDir(root, func(path string, d os.DirEntry, err error) error {
			if err != nil {
				return nil // ignore errors
			}
			if d.IsDir() {
				return nil
			}
			select {
			case <-ctx.Done():
				return ctx.Err()
			default:
			}
			info, err := d.Info()
			if err != nil {
				return nil
			}
			size := info.Size()
			hash, err := fileSHA1(path)
			if err != nil {
				return nil
			}
			if existing, ok := cat.GetByID(hash); ok {
				if existing.Size == size && existing.Hash == hash {
					return nil
				}
			}
			mimeType := mime.TypeByExtension(filepath.Ext(path))
			if mimeType == "" {
				f, err := os.Open(path)
				if err == nil {
					defer f.Close()
					buf := make([]byte, 512)
					n, _ := f.Read(buf)
					mimeType = http.DetectContentType(buf[:n])
				}
			}
			rel, _ := filepath.Rel(root, filepath.Dir(path))
			rel = strings.TrimPrefix(rel, string(filepath.Separator))
			a := catalog.Asset{ID: hash, Key: filepath.Base(path), Size: size, Hash: hash, MIME: mimeType, Folder: rel, OriginPath: path}
			return cat.Upsert(a)
		})
		if err != nil && err != context.Canceled {
			return err
		}
	}
	return nil
}

func fileSHA1(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha1.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", h.Sum(nil)), nil
}
