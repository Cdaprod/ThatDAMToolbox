package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	RTCPPacketsLost = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "proxy_rtcp_packets_lost",
			Help: "RTCP reported packet loss",
		},
	)
	SRTBandwidth = prometheus.NewGauge(
		prometheus.GaugeOpts{
			Name: "proxy_srt_bandwidth_bytes",
			Help: "Current SRT bandwidth in bytes per second",
		},
	)
)

// Metrics wraps registered metrics.
type Metrics struct{}

// New registers metrics and returns the wrapper.
func New() *Metrics {
	prometheus.MustRegister(RTCPPacketsLost, SRTBandwidth)
	return &Metrics{}
}

// Handler returns the Prometheus handler.
func (m *Metrics) Handler() http.Handler {
	return promhttp.Handler()
}

// RecordRTCP sets packet loss.
func (m *Metrics) RecordRTCP(loss float64) { RTCPPacketsLost.Set(loss) }

// RecordSRT sets bandwidth gauge.
func (m *Metrics) RecordSRT(bw int64) { SRTBandwidth.Set(float64(bw)) }
