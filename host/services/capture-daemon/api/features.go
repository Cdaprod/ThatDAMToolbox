// /host/services/capture-daemon/api/features.go
package api

import (
	"encoding/json"
	"net/http"

	"github.com/Cdaprod/ThatDamToolbox/host/services/capture-daemon/config"
)

// RegisterFeatureRoutes wires up the feature flag endpoint.
func RegisterFeatureRoutes(mux *http.ServeMux, cfg *config.Config) {
	mux.HandleFunc("/features", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			w.WriteHeader(http.StatusMethodNotAllowed)
			return
		}

		type resp struct {
			HLSPreview bool `json:"hls"`
			MP4Serve   bool `json:"mp4"`
			WebRTC     bool `json:"webrtc"`
		}

		out := resp{
			HLSPreview: cfg.Features.HLSPreview.Enabled,
			MP4Serve:   cfg.Features.MP4Serve.Enabled,
			WebRTC:     cfg.Features.WebRTC.Enabled,
		}

		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(out)
	})
}
