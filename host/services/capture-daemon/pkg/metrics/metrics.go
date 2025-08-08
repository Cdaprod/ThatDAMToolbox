// host/services/capture-daemon/pkg/metrics/metrics.go
package metrics

import (
	"net/http"
	// "time" // Unused

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	DevicesDiscovered = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "capture_devices_discovered",
			Help: "Number of devices discovered",
		}, []string{"kind"},
	)
	DevicesActive = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "capture_devices_active",
			Help: "Number of active capture loops",
		}, []string{"device"},
	)
	CaptureErrors = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "capture_errors_total",
			Help: "Count of capture errors",
		}, []string{"device", "type"},
	)
)

type Metrics struct{}

// New registers all metrics and returns a handler wrapper.
func New() *Metrics {
	prometheus.MustRegister(DevicesDiscovered, DevicesActive, CaptureErrors)
	return &Metrics{}
}

// Handler returns the Prometheus HTTP handler.
func (m *Metrics) Handler() http.Handler {
	return promhttp.Handler()
}

// RecordDeviceDiscovered sets the gauge for a device kind.
func (m *Metrics) RecordDeviceDiscovered(kind string, count int) {
	DevicesDiscovered.WithLabelValues(kind).Set(float64(count))
}

// RecordDeviceActive marks a device active (1) or inactive (0).
func (m *Metrics) RecordDeviceActive(device string, active bool) {
	if active {
		DevicesActive.WithLabelValues(device).Set(1)
	} else {
		DevicesActive.WithLabelValues(device).Set(0)
	}
}

// RecordError increments the error counter for a device/type.
func (m *Metrics) RecordError(device, errType string) {
	CaptureErrors.WithLabelValues(device, errType).Inc()
}
