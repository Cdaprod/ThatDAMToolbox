// Package runners logs runner registrations.
package runners

import (
	"encoding/json"
	"net/http"
	"text/template"
	"time"
)

var runnerScript = template.Must(template.New("script").Parse(`#!/bin/sh
# Runner registration script
TOKEN="{{.Token}}"
PROFILE="{{.Profile}}"

echo "Registering $PROFILE with token $TOKEN"`))

// RegisterHandler handles POST /runners/register and returns a shell script.
// Example:
//
//	curl -X POST http://localhost:8081/runners/register -d '{"profile":"capture"}'
func RegisterHandler(store RunnerStore) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}

		var req struct {
			Profile string `json:"profile"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}

		token, err := GenerateToken()
		if err != nil {
			http.Error(w, "token error", http.StatusInternalServerError)
			return
		}

		_ = store.Log(RunnerRegistration{ID: token, Profile: req.Profile, Created: time.Now()})
		ApplySupervisorFlags(req.Profile)

		w.Header().Set("Content-Type", "text/plain")
		if err := runnerScript.Execute(w, map[string]string{"Token": token, "Profile": req.Profile}); err != nil {
			http.Error(w, "template error", http.StatusInternalServerError)
			return
		}
	}
}
