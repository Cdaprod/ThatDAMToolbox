package supervisor

// Package supervisor provides a minimal client for the supervisor control plane.
//
// Example:
//   os.Setenv("SUPERVISOR_URL", "http://supervisor:8070")
//   os.Setenv("SUPERVISOR_API_KEY", "secret")
//   supervisor.Register(ctx, supervisor.Agent{ID: "cam1"})

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"

	"github.com/Cdaprod/ThatDamToolbox/host/services/shared/supervisor/plan"
)

// Agent metadata sent to the supervisor.
type Agent struct {
	ID       string         `json:"id"`
	Class    string         `json:"class,omitempty"`
	Version  string         `json:"version,omitempty"`
	Features []string       `json:"features,omitempty"`
	Address  string         `json:"address,omitempty"`
	Meta     map[string]any `json:"meta,omitempty"`
}

func client() (baseURL, apiKey, token string) {
	return os.Getenv("SUPERVISOR_URL"), os.Getenv("SUPERVISOR_API_KEY"), os.Getenv("SUPERVISOR_TOKEN")
}

// Register registers agent a with the supervisor.
// If SUPERVISOR_URL is unset, Register is a no-op.
func Register(ctx context.Context, a Agent) error {
	baseURL, apiKey, token := client()
	if baseURL == "" {
		return nil
	}
	b, err := json.Marshal(a)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/register", bytes.NewReader(b))
	if err != nil {
		return err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	} else if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}
	req.Header.Set("Content-Type", "application/json")
	hc := &http.Client{Timeout: 5 * time.Second}
	resp, err := hc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		io.CopyN(io.Discard, resp.Body, 1024)
		return fmt.Errorf("supervisor register: %s", resp.Status)
	}
	return nil
}

// Heartbeat sends a heartbeat for id to the supervisor.
// If SUPERVISOR_URL is unset, Heartbeat is a no-op.
func Heartbeat(ctx context.Context, id string) error {
	baseURL, apiKey, token := client()
	if baseURL == "" {
		return nil
	}
	b, _ := json.Marshal(map[string]string{"id": id})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/heartbeat", bytes.NewReader(b))
	if err != nil {
		return err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	} else if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}
	req.Header.Set("Content-Type", "application/json")
	hc := &http.Client{Timeout: 5 * time.Second}
	resp, err := hc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		io.CopyN(io.Discard, resp.Body, 1024)
		return fmt.Errorf("supervisor heartbeat: %s", resp.Status)
	}
	return nil
}

// FetchPlan requests a DesiredPlan from the supervisor. If SUPERVISOR_URL is
// unset the zero DesiredPlan is returned.
//
// Example:
//
//	dp, _ := supervisor.FetchPlan(ctx, map[string]string{"node_id": "n1"})
func FetchPlan(ctx context.Context, reqPayload any) (plan.DesiredPlan, error) {
	var dp plan.DesiredPlan
	baseURL, apiKey, token := client()
	if baseURL == "" {
		return dp, nil
	}
	b, err := json.Marshal(reqPayload)
	if err != nil {
		return dp, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL+"/plan", bytes.NewReader(b))
	if err != nil {
		return dp, err
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	} else if apiKey != "" {
		req.Header.Set("X-API-Key", apiKey)
	}
	req.Header.Set("Content-Type", "application/json")
	hc := &http.Client{Timeout: 5 * time.Second}
	resp, err := hc.Do(req)
	if err != nil {
		return dp, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		io.CopyN(io.Discard, resp.Body, 1024)
		return dp, fmt.Errorf("supervisor plan: %s", resp.Status)
	}
	if err := json.NewDecoder(resp.Body).Decode(&dp); err != nil {
		return dp, err
	}
	return dp, nil
}
