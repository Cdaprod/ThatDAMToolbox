package state

import (
	"os"
	"path/filepath"
	"strings"
)

// Store persists generation hashes.
type Store struct{ dir string }

// NewDiskStore creates a disk-backed store.
func NewDiskStore(dir string) Store {
	_ = os.MkdirAll(dir, 0o755)
	return Store{dir: dir}
}

func (s Store) genPath(node string) string {
	return filepath.Join(s.dir, sanitize(node)+".gen")
}

// LoadGeneration reads last generation for node.
func (s Store) LoadGeneration(node string) (string, error) {
	b, err := os.ReadFile(s.genPath(node))
	if err != nil {
		return "", err
	}
	return strings.TrimSpace(string(b)), nil
}

// SaveGeneration writes generation for node.
func (s Store) SaveGeneration(node, gen string) error {
	return os.WriteFile(s.genPath(node), []byte(gen+"\n"), 0o644)
}

func sanitize(s string) string {
	r := strings.Map(func(r rune) rune {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') || (r >= '0' && r <= '9') || r == '-' || r == '_' {
			return r
		}
		return '_'
	}, s)
	if r == "" {
		return "node"
	}
	return r
}
