package catalog

import "time"

// Asset describes a stored media object.
type Asset struct {
	ID          string            `json:"id"`
	Key         string            `json:"key"`
	Size        int64             `json:"size"`
	Hash        string            `json:"hash"`
	MIME        string            `json:"mime"`
	Folder      string            `json:"folder"`
	Labels      map[string]string `json:"labels,omitempty"`
	CreatedAt   time.Time         `json:"created_at"`
	SourceNode  string            `json:"source_node"`
	OriginPath  string            `json:"origin_path"`
	ExternalRef bool              `json:"external_ref"`
}

// Catalog indexes assets for query by services.
type Catalog interface {
	Upsert(a Asset) error
	GetByID(id string) (Asset, bool)
	ListByFolder(folder string, page, pageSize int) ([]Asset, int)
	ListFolders(prefix string) []string
	Delete(id string) error
}
