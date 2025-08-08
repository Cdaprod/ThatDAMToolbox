package overlay

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestRegister(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	c := NewClient(srv.URL)
	if err := c.Register(context.Background(), "a1"); err != nil {
		t.Fatalf("register failed: %v", err)
	}
}

func TestRegisterError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer srv.Close()
	c := NewClient(srv.URL)
	if err := c.Register(context.Background(), "a1"); err == nil {
		t.Fatal("expected error")
	}
}

func TestHeartbeatCancel(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()
	c := NewClient(srv.URL)
	ctx, cancel := context.WithCancel(context.Background())
	go c.Heartbeat(ctx, 10*time.Millisecond)
	time.Sleep(20 * time.Millisecond)
	cancel()
}
