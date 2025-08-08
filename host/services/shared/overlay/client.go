package overlay

// Client is a minimal HTTP overlay client.
//
// Example:
//  c := overlay.NewClient("http://localhost:8090")
//  _ = c.Register(context.Background(), "agent-1")

import (
	"context"
	"fmt"
	"net/http"
	"time"
)

type Client struct {
	hub  string
	http *http.Client
}

func NewClient(hub string) *Client {
	return &Client{hub: hub, http: &http.Client{Timeout: 5 * time.Second}}
}

// Register registers an agent with the overlay hub.
func (c *Client) Register(ctx context.Context, agentID string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.hub+"/v1/register", nil)
	if err != nil {
		return err
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("register: %s", resp.Status)
	}
	return nil
}

// Heartbeat periodically notifies the hub that the agent is alive.
func (c *Client) Heartbeat(ctx context.Context, interval time.Duration) {
	t := time.NewTicker(interval)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			_, _ = c.http.Post(c.hub+"/v1/heartbeat", "application/json", nil)
		}
	}
}
