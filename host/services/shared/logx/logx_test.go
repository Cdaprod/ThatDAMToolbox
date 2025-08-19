package logx

import (
	"bytes"
	"testing"
)

func TestLoggerJSONInCI(t *testing.T) {
	b := &bytes.Buffer{}
	Init(Config{Writer: b, Format: "json", Service: "test"})
	L.Info("hi", "x", 1)
	if !bytes.Contains(b.Bytes(), []byte(`"level":"info"`)) {
		t.Fatalf("expected json log line, got %s", b.String())
	}
}
