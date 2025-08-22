package broker

import (
	"sync"
	"testing"
)

func TestPublishSchemas_NoPanic(t *testing.T) {
	// exercise builder logic; since Publish() is no-op until Init() succeeds,
	// this should never panic.
	PublishSchemas()
}

func TestInitReadsEnv(t *testing.T) {
	t.Setenv("EVENT_BROKER_URL", "amqp://test/")
	// reset globals for test
	Close()
	addr = ""
	exchangeName = ""
	bufSize = 0
	buf = nil
	initOnce = sync.Once{}

	Init()
	if addr != "amqp://test/" {
		t.Fatalf("addr not set from env; got %q", addr)
	}
	Close()
	initOnce = sync.Once{}
}
