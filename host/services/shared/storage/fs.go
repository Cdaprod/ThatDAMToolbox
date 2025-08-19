package storage

import (
	"io"
	"io/fs"
	"os"
	"path/filepath"

	"github.com/Cdaprod/ThatDamToolbox/host/shared/platform"
)

// FS implements BlobStore on the local filesystem.
type FS struct {
	base string
	de   platform.DirEnsurer
}

// NewFS returns a filesystem-backed store rooted at base.
// Example:
//
//	bs := storage.NewFS("/tmp/data", platform.NewOSDirEnsurer())
func NewFS(base string, de platform.DirEnsurer) *FS { return &FS{base: base, de: de} }

func (f *FS) full(key string) string { return filepath.Join(f.base, filepath.FromSlash(key)) }

func (f *FS) Put(key string, r io.Reader) error {
	p := f.full(key)
	uid, gid := os.Getuid(), os.Getgid()
	if err := f.de.EnsureDirs([]platform.FileSpec{{Path: filepath.Dir(p), UID: uid, GID: gid, Mode: 0o755}}); err != nil {
		return err
	}
	tmp := p + ".part"
	w, err := os.Create(tmp)
	if err != nil {
		return err
	}
	if _, err := io.Copy(w, r); err != nil {
		w.Close()
		os.Remove(tmp)
		return err
	}
	if err := w.Close(); err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, p)
}

func (f *FS) Get(key string) (io.ReadCloser, error) { return os.Open(f.full(key)) }

func (f *FS) Delete(key string) error { return os.Remove(f.full(key)) }

func (f *FS) Exists(key string) (bool, error) {
	_, err := os.Stat(f.full(key))
	if err == nil {
		return true, nil
	}
	if os.IsNotExist(err) {
		return false, nil
	}
	return false, err
}

func (f *FS) List(prefix string, visit func(key string) bool) error {
	root := f.full(prefix)
	return filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(f.base, path)
		if err != nil {
			return err
		}
		if !visit(filepath.ToSlash(rel)) {
			return filepath.SkipDir
		}
		return nil
	})
}
