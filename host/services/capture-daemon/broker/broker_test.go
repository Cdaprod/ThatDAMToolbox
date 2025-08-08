package broker

import (
	"testing"
)

func TestPublishSchemas_NoPanic(t *testing.T) {
	// exercise builder logic; since Publish() is no-op until Init() succeeds,
	// this should never panic.
	PublishSchemas()
}
