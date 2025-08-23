package httpapi

import (
	"encoding/json"
	"math/rand"
	"net/http"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/auth-bridge/internal/pair"
)

// PairStart begins device pairing and returns codes.
// Example:
//
//	curl -X POST /pair/start
func PairStart(w http.ResponseWriter, r *http.Request) {
	device := randSeq(8)
	code := randSeq(6)
	pair.Create(code, device)
	json.NewEncoder(w).Encode(map[string]any{
		"device_code":      device,
		"user_code":        code,
		"verification_url": "https://app.example.com/pair/verify",
		"poll_url":         "/pair/poll?device=" + device,
		"expires_in":       300,
	})
}

// PairPoll checks pairing status for a device.
func PairPoll(w http.ResponseWriter, r *http.Request) {
	device := r.URL.Query().Get("device")
	ok, p := pair.GetByDevice(device)
	if !ok {
		http.Error(w, "unknown_device", http.StatusNotFound)
		return
	}
	if !p.Approved {
		w.WriteHeader(http.StatusAccepted)
		json.NewEncoder(w).Encode(map[string]any{"status": "pending"})
		return
	}
	json.NewEncoder(w).Encode(map[string]any{"status": "approved", "njt": p.NJT})
}

func randSeq(n int) string {
	const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func init() {
	rand.Seed(time.Now().UnixNano())
}
