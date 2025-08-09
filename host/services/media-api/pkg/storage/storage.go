// /host/services/media-api/pkg/storage/storage.go
// Package storage defines interfaces for media metadata retrieval.
package storage

import "context"

// Video represents minimal metadata for a video record.
type Video struct {
	SHA1 string
}

// Engine abstracts the persistence layer.
type Engine interface {
	// GetVideo returns metadata for the given SHA1.
	GetVideo(ctx context.Context, sha1 string) (Video, error)
}
