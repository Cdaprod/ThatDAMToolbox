package encoder

import (
	"testing"
	"time"

	promtest "github.com/prometheus/client_golang/prometheus/testutil"
)

func TestLatencyModes(t *testing.T) {
	m := RegisterMetrics()
	cases := []struct {
		mode LatencyMode
		want time.Duration
	}{
		{LatencyRealtime, 10 * time.Millisecond},
		{LatencyBalanced, 30 * time.Millisecond},
		{LatencyThroughput, 60 * time.Millisecond},
	}
	for _, c := range cases {
		enc := NewMock(Config{Backend: BackendVAAPI, Latency: c.mode}, m)
		start := time.Now()
		if err := enc.Encode([]byte{1}); err != nil {
			t.Fatalf("encode failed: %v", err)
		}
		if dur := time.Since(start); dur < c.want {
			t.Fatalf("mode %v latency %v < %v", c.mode, dur, c.want)
		}
	}

	enc := NewMock(Config{Backend: BackendVAAPI, Latency: LatencyRealtime}, m)
	_ = enc.Encode(nil)
	if got := promtest.ToFloat64(m.FrameDrops.WithLabelValues(string(BackendVAAPI))); got != 1 {
		t.Fatalf("expected 1 drop, got %v", got)
	}
}
