// Package tests provides utilities to measure end-to-end latency and jitter
// across transports using synthetic camera fixtures.
//
// Example:
//
//	go test ./tests -run TestTransportLatency -v
//
// The test simulates an encoder → transport → viewer pipeline and asserts
// latency and jitter thresholds for WebRTC, SRT, and RTP/PTP transports.
package tests

import (
	"math"
	"math/rand"
	"testing"
	"time"
)

type transportCase struct {
	name      string
	baseDelay time.Duration
	jitter    time.Duration
	threshold time.Duration
}

func simulatePipeline(r *rand.Rand, tc transportCase, frames int) (time.Duration, time.Duration) {
	latencies := make([]time.Duration, frames)
	for i := 0; i < frames; i++ {
		start := time.Now()
		frame := simulateFrame()

		encoded := encodeFrame(frame)

		transportDelay := tc.baseDelay + time.Duration(r.Int63n(int64(tc.jitter*2))) - tc.jitter
		transported := transportFrame(encoded, transportDelay)

		renderFrame(transported)
		latencies[i] = time.Since(start)
	}

	var total time.Duration
	for _, l := range latencies {
		total += l
	}
	avg := total / time.Duration(frames)

	var variance float64
	for _, l := range latencies {
		diff := float64(l - avg)
		variance += diff * diff
	}
	stddev := time.Duration(math.Sqrt(variance / float64(frames)))
	return avg, stddev
}

func simulateFrame() []byte {
	return []byte{0x00}
}

func encodeFrame(frame []byte) []byte {
	time.Sleep(1 * time.Millisecond)
	return frame
}

func transportFrame(frame []byte, delay time.Duration) []byte {
	time.Sleep(delay)
	return frame
}

func renderFrame(frame []byte) {
	time.Sleep(1 * time.Millisecond)
}

func TestTransportLatency(t *testing.T) {
	r := rand.New(rand.NewSource(42))
	cases := []transportCase{
		{name: "WebRTC", baseDelay: 170 * time.Millisecond, jitter: 20 * time.Millisecond, threshold: 200 * time.Millisecond},
		{name: "SRT", baseDelay: 175 * time.Millisecond, jitter: 20 * time.Millisecond, threshold: 200 * time.Millisecond},
		{name: "RTP/PTP", baseDelay: 5 * time.Millisecond, jitter: 2 * time.Millisecond, threshold: 10 * time.Millisecond},
	}

	for _, tc := range cases {
		avg, jit := simulatePipeline(r, tc, 5)
		if avg > tc.threshold {
			t.Errorf("%s latency %v exceeds %v", tc.name, avg, tc.threshold)
		}
		if jit > tc.threshold {
			t.Errorf("%s jitter %v exceeds %v", tc.name, jit, tc.threshold)
		}
		t.Logf("%s latency=%v jitter=%v", tc.name, avg, jit)
	}
}
