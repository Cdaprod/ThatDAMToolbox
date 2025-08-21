package srt_test

import (
	"context"
	"testing"

	srt "github.com/Cdaprod/ThatDamToolbox/host/services/shared/stream/adapter/srt"
)

// TestOpen verifies SRT URL construction with streamid.
func TestOpen(t *testing.T) {
	ad := srt.New("srt://localhost:9000")
	details, err := ad.Open(context.Background(), "cam1")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	if got := details["uri"]; got != "srt://localhost:9000?streamid=cam1" {
		t.Fatalf("unexpected uri: %v", got)
	}
}
