// Package encoder provides configurable video encoder interfaces and telemetry.
//
// Example usage:
//
//	cfg := encoder.Config{Mode: encoder.ModeAllI, Backend: encoder.BackendVAAPI,
//	    Bitrate: 2000, GOP: 60, Latency: encoder.LatencyRealtime}
//	enc := encoder.NewMock(cfg, nil)
//	enc.Encode(frame)
package encoder

import (
	"time"

	"github.com/prometheus/client_golang/prometheus"
)

// Mode represents GOP layout options.
type Mode string

const (
	// ModeAllI encodes every frame as an I-frame.
	ModeAllI Mode = "all-i"
	// ModeIPB uses inter-frame prediction (IPB pattern).
	ModeIPB Mode = "ipb"
	// ModeIntraOnly encodes keyframes only, dropping inter frames.
	ModeIntraOnly Mode = "intra-only"
)

// Backend identifies hardware acceleration backends.
type Backend string

const (
	BackendVAAPI        Backend = "vaapi"
	BackendNVENC        Backend = "nvenc"
	BackendV4L2M2M      Backend = "v4l2m2m"
	BackendVideoToolbox Backend = "videotoolbox"
)

// LatencyMode tunes encoding speed vs compression.
type LatencyMode string

const (
	LatencyRealtime   LatencyMode = "realtime"
	LatencyBalanced   LatencyMode = "balanced"
	LatencyThroughput LatencyMode = "throughput"
)

// Config defines encoder options.
type Config struct {
	Mode    Mode
	Backend Backend
	Bitrate int
	GOP     int
	Latency LatencyMode
}

// Metrics holds Prometheus metrics for encoders.
type Metrics struct {
	FrameDelay *prometheus.HistogramVec
	FrameDrops *prometheus.CounterVec
}

// RegisterMetrics creates and registers encoder metrics.
func RegisterMetrics() *Metrics {
	m := &Metrics{
		FrameDelay: prometheus.NewHistogramVec(
			prometheus.HistogramOpts{
				Name:    "encoder_frame_delay_seconds",
				Help:    "Time spent encoding a frame",
				Buckets: prometheus.DefBuckets,
			}, []string{"backend"},
		),
		FrameDrops: prometheus.NewCounterVec(
			prometheus.CounterOpts{
				Name: "encoder_frame_drops_total",
				Help: "Number of frames dropped by encoder",
			}, []string{"backend"},
		),
	}
	prometheus.MustRegister(m.FrameDelay, m.FrameDrops)
	return m
}

// Encoder defines the behaviour of a video encoder.
type Encoder interface {
	Encode([]byte) error
}

// mock implements Encoder for tests.
type mock struct {
	cfg     Config
	metrics *Metrics
}

// NewMock returns a simple encoder that simulates latency and records metrics.
func NewMock(cfg Config, m *Metrics) Encoder {
	if m == nil {
		m = RegisterMetrics()
	}
	return &mock{cfg: cfg, metrics: m}
}

// Encode records frame delay and optional drops. Empty frames are treated as drops.
func (m *mock) Encode(b []byte) error {
	start := time.Now()
	if len(b) == 0 {
		m.metrics.FrameDrops.WithLabelValues(string(m.cfg.Backend)).Inc()
		return nil
	}
	time.Sleep(latencyDuration(m.cfg.Latency))
	m.metrics.FrameDelay.WithLabelValues(string(m.cfg.Backend)).Observe(time.Since(start).Seconds())
	return nil
}

func latencyDuration(l LatencyMode) time.Duration {
	switch l {
	case LatencyRealtime:
		return 10 * time.Millisecond
	case LatencyThroughput:
		return 60 * time.Millisecond
	default:
		return 30 * time.Millisecond
	}
}
