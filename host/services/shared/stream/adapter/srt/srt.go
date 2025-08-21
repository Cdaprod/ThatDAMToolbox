// Package srt provides a minimal Adapter for SRT streaming.
//
// Example:
//
//	ad := srt.New("srt://localhost:9000")
//	details, _ := ad.Open(context.Background(), "cam1")
//	fmt.Println(details["uri"]) // srt://localhost:9000?streamid=cam1
package srt

import (
	"context"
	"fmt"
	"net/url"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/stream"
)

type adapter struct{ base *url.URL }

// New returns an Adapter that builds SRT URLs from base.
func New(base string) stream.Adapter {
	u, _ := url.Parse(base)
	return adapter{base: u}
}

func (adapter) Name() string { return "srt" }

func (a adapter) Open(ctx context.Context, device string) (map[string]any, error) {
	if a.base == nil {
		return nil, fmt.Errorf("no base URL")
	}
	q := a.base.Query()
	q.Set("streamid", device)
	u := *a.base
	u.RawQuery = q.Encode()
	return map[string]any{"uri": u.String()}, nil
}

func (adapter) Close(id string) error { return nil }
