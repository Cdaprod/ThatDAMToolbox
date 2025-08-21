// Package api provides HTTP handlers for capture-daemon.
//
// RegisterSRTRoutes adds /srt endpoint that negotiates SRT URLs.
// Example:
//
//	api.RegisterSRTRoutes(mux, "srt://localhost:9000")
//	# curl 'http://daemon/srt?device=cam1' -> {"uri":"srt://localhost:9000?streamid=cam1"}
package api

import (
	"encoding/json"
	"net/http"

	srt "github.com/Cdaprod/ThatDamToolbox/host/services/shared/stream/adapter/srt"
)

// RegisterSRTRoutes exposes /srt for SRT URL negotiation.
func RegisterSRTRoutes(mux *http.ServeMux, base string) {
	if base == "" {
		return
	}
	mux.HandleFunc("/srt", func(w http.ResponseWriter, r *http.Request) {
		id := r.URL.Query().Get("device")
		if id == "" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		ad := srt.New(base)
		details, err := ad.Open(r.Context(), id)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(details)
	})
}
